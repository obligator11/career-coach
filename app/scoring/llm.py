import json
import httpx
from pydantic import BaseModel, Field
from app.config import settings


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