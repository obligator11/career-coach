import asyncio
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.models import User, Repo, Commit
from app.github_client import list_user_repos, list_repo_commits


def sync_user_repos(db: Session, user: User) -> list[Repo]:
    """Ensure every GitHub repo the user has access to exists as a Repo row."""
    github_repos = asyncio.run(list_user_repos(user.github_access_token))

    synced = []
    for gh_repo in github_repos:
        existing = db.query(Repo).filter(Repo.github_repo_id == str(gh_repo["id"])).first()
        if existing:
            synced.append(existing)
            continue

        new_repo = Repo(
            user_id=user.id,
            github_repo_id=str(gh_repo["id"]),
            name=gh_repo["full_name"],
        )
        db.add(new_repo)
        db.commit()
        db.refresh(new_repo)
        synced.append(new_repo)

    return synced


def sync_repo_commits(db: Session, user: User, repo: Repo) -> int:
    """Pull commits for one repo and insert any that aren't already stored. Returns count of new commits."""
    owner, repo_name = repo.name.split("/")
    github_commits = asyncio.run(
        list_repo_commits(user.github_access_token, owner, repo_name)
    )

    new_count = 0
    for gh_commit in github_commits:
        sha = gh_commit["sha"]

        already_exists = (
            db.query(Commit)
            .filter(Commit.repo_id == repo.id, Commit.sha == sha)
            .first()
        )
        if already_exists:
            continue

        commit_info = gh_commit["commit"]
        committed_at_str = commit_info["author"]["date"]
        committed_at = datetime.strptime(committed_at_str, "%Y-%m-%dT%H:%M:%SZ")

        new_commit = Commit(
            repo_id=repo.id,
            sha=sha,
            message=commit_info["message"],
            committed_at=committed_at,
            raw_metadata=gh_commit,
        )
        db.add(new_commit)
        new_count += 1

    db.commit()
    repo.last_synced_at = datetime.utcnow()
    db.commit()

    return new_count


def run_ingestion_for_user(github_id: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.github_id == github_id).first()
        if not user:
            print(f"No user found with github_id={github_id}")
            return

        repos = sync_user_repos(db, user)
        print(f"Synced {len(repos)} repos for {user.github_id}")

        for repo in repos:
            count = sync_repo_commits(db, user, repo)
            print(f"  {repo.name}: {count} new commits")
    finally:
        db.close()