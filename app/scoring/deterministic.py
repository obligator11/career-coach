from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import Commit, Repo
import asyncio
from app.github_client import get_commit_detail

EXTENSION_TO_LANGUAGE = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".sql": "SQL",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".json": "JSON",
    ".md": "Markdown",
    ".html": "HTML",
    ".css": "CSS",
    ".sh": "Shell",
    ".ps1": "PowerShell",
    ".dockerfile": "Docker",
}


def commit_frequency_score(db: Session, repo: Repo) -> dict:
    """Measure how regularly a user commits to this repo."""
    commits = (
        db.query(Commit)
        .filter(Commit.repo_id == repo.id)
        .order_by(Commit.committed_at)
        .all()
    )

    if len(commits) < 2:
        return {
            "total_commits": len(commits),
            "active_days": len(commits),
            "commits_per_active_day": float(len(commits)),
            "longest_gap_days": 0,
        }

    days_with_commits = defaultdict(int)
    for c in commits:
        day_key = c.committed_at.date()
        days_with_commits[day_key] += 1

    active_days = sorted(days_with_commits.keys())
    gaps = [
        (active_days[i + 1] - active_days[i]).days
        for i in range(len(active_days) - 1)
    ]
    longest_gap = max(gaps) if gaps else 0

    return {
        "total_commits": len(commits),
        "active_days": len(active_days),
        "commits_per_active_day": round(len(commits) / len(active_days), 2),
        "longest_gap_days": longest_gap,
    }



def detect_languages(db: Session, user, repo: Repo, sample_size: int = 5) -> dict:
    """Sample the most recent commits in a repo and tally file extensions."""
    recent_commits = (
        db.query(Commit)
        .filter(Commit.repo_id == repo.id)
        .order_by(Commit.committed_at.desc())
        .limit(sample_size)
        .all()
    )

    owner, repo_name = repo.name.split("/")
    language_counts: dict[str, int] = defaultdict(int)

    for commit in recent_commits:
        detail = asyncio.run(
            get_commit_detail(user.github_access_token, owner, repo_name, commit.sha)
        )
        for f in detail.get("files", []):
            filename = f["filename"].lower()
            for ext, lang in EXTENSION_TO_LANGUAGE.items():
                if filename.endswith(ext):
                    language_counts[lang] += 1
                    break

    total = sum(language_counts.values())
    if total == 0:
        return {"languages": {}, "primary_language": None}

    percentages = {
        lang: round((count / total) * 100, 1)
        for lang, count in language_counts.items()
    }
    primary = max(percentages, key=percentages.get)

    return {"languages": percentages, "primary_language": primary}



def complexity_score(db: Session, user, repo: Repo, sample_size: int = 5) -> dict:
    """Sample recent commits and measure size/spread of changes."""
    recent_commits = (
        db.query(Commit)
        .filter(Commit.repo_id == repo.id)
        .order_by(Commit.committed_at.desc())
        .limit(sample_size)
        .all()
    )

    owner, repo_name = repo.name.split("/")
    total_additions = 0
    total_deletions = 0
    total_files_changed = 0
    sampled = 0

    for commit in recent_commits:
        detail = asyncio.run(
            get_commit_detail(user.github_access_token, owner, repo_name, commit.sha)
        )
        stats = detail.get("stats", {})
        total_additions += stats.get("additions", 0)
        total_deletions += stats.get("deletions", 0)
        total_files_changed += len(detail.get("files", []))
        sampled += 1

    if sampled == 0:
        return {"avg_lines_changed": 0, "avg_files_per_commit": 0, "sampled_commits": 0}

    return {
        "avg_lines_changed": round((total_additions + total_deletions) / sampled, 1),
        "avg_files_per_commit": round(total_files_changed / sampled, 1),
        "sampled_commits": sampled,
    }