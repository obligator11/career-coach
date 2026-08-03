from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import Commit, Repo


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