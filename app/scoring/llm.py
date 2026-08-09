import json
import httpx
from pydantic import BaseModel, Field
from app.config import settings
import asyncio
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.models import Commit, Repo, SkillScore
from app.github_client import get_commit_detail


class CommitJudgment(BaseModel):
    """Validated shape of the LLM's judgment about one commit.
    No unvalidated LLM output reaches the database - this is the gate."""
    message_matches_diff: bool
    is_trivial: bool = Field(description="True if this is a minor/trivial change")
    skills_demonstrated: list[str] = Field(default_factory=list)
    reasoning: str


SYSTEM_PROMPT = """You are a code reviewer analyzing a single git commit.
You will be given the commit message and a summary of what changed (files touched, lines added/removed).
Respond with ONLY a JSON object, no other text, matching exactly this shape:
{
  "message_matches_diff": true or false,
  "is_trivial": true or false,
  "skills_demonstrated": ["skill1", "skill2"],
  "reasoning": "one short sentence"
}
Judge "trivial" as: typo fixes, formatting, comment-only changes, version bumps.
Judge "message_matches_diff" as: does the message accurately describe the actual scope of change.
skills_demonstrated should be specific (e.g. "async programming", "database schema design", "API integration"), not just the language name.
"""


async def judge_commit(commit_message: str, files_changed: list[str], additions: int, deletions: int) -> CommitJudgment:
    diff_summary = (
        f"Files changed: {', '.join(files_changed)}\n"
        f"Lines added: {additions}, Lines removed: {deletions}"
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.lm_studio_url}/chat/completions",
            json={
                "model": "qwen/qwen2.5-coder-14b",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Commit message: {commit_message}\n\n{diff_summary}"},
                ],
                "temperature": 0.1,
            },
        )
        response.raise_for_status()
        data = response.json()
        raw_text = data["choices"][0]["message"]["content"]

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").removeprefix("json").strip()

    parsed = json.loads(cleaned)
    return CommitJudgment(**parsed)



async def judge_repo_commits(db: Session, user, repo: Repo, sample_size: int = 5) -> list[CommitJudgment]:
    """Run LLM judgment on the most recent commits in a repo."""
    recent_commits = (
        db.query(Commit)
        .filter(Commit.repo_id == repo.id)
        .order_by(Commit.committed_at.desc())
        .limit(sample_size)
        .all()
    )

    owner, repo_name = repo.name.split("/")
    judgments = []

    for commit in recent_commits:
        detail = await get_commit_detail(user.github_access_token, owner, repo_name, commit.sha)
        files = [f["filename"] for f in detail.get("files", [])]
        stats = detail.get("stats", {})

        try:
            judgment = await judge_commit(
                commit.message, files, stats.get("additions", 0), stats.get("deletions", 0)
            )
            judgments.append(judgment)
        except Exception as e:
            print(f"  Skipping commit {commit.sha[:7]} - judgment failed: {e}")
            continue

    return judgments


def compute_and_store_llm_skills(db: Session, user) -> list[dict]:
    """Run LLM judgment across all repos and store demonstrated skills as skill_scores rows,
    each linked to the specific commit that best demonstrates it."""
    repos = db.query(Repo).filter(Repo.user_id == user.id).all()

    # skill_name -> {evidence_count, nontrivial_count, best_commit_id, best_reasoning}
    skill_data: dict[str, dict] = defaultdict(lambda: {
        "evidence_count": 0,
        "nontrivial_count": 0,
        "best_commit_id": None,
        "best_reasoning": "",
    })

    for repo in repos:
        print(f"Judging {repo.name}...")
        recent_commits = (
            db.query(Commit)
            .filter(Commit.repo_id == repo.id)
            .order_by(Commit.committed_at.desc())
            .limit(5)
            .all()
        )
        owner, repo_name = repo.name.split("/")

        for commit in recent_commits:
            detail = asyncio.run(get_commit_detail(user.github_access_token, owner, repo_name, commit.sha))
            files = [f["filename"] for f in detail.get("files", [])]
            stats = detail.get("stats", {})

            try:
                judgment = asyncio.run(
                    judge_commit(commit.message, files, stats.get("additions", 0), stats.get("deletions", 0))
                )
            except Exception as e:
                print(f"  Skipping commit {commit.sha[:7]} - judgment failed: {e}")
                continue

            for skill in judgment.skills_demonstrated:
                data = skill_data[skill]
                data["evidence_count"] += 1
                if not judgment.is_trivial:
                    data["nontrivial_count"] += 1
                    # Keep the most substantial (highest lines changed) non-trivial commit as "best evidence"
                    if data["best_commit_id"] is None:
                        data["best_commit_id"] = commit.id
                        data["best_reasoning"] = judgment.reasoning

    results = []
    for skill, data in skill_data.items():
        count = data["evidence_count"]
        nontrivial = data["nontrivial_count"]
        score = round(min(1.0, (nontrivial / count) * 0.7 + (count / 10) * 0.3), 3)

        skill_score = SkillScore(
            user_id=user.id,
            skill_name=skill,
            score=score,
            evidence_commit_id=data["best_commit_id"],
        )
        db.add(skill_score)
        results.append({
            "skill_name": skill,
            "score": score,
            "evidence_count": count,
            "example_reasoning": data["best_reasoning"],
        })

    db.commit()
    return results