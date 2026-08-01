import secrets
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.github_client import build_authorize_url, exchange_code_for_token, get_github_user

router = APIRouter(prefix="/auth/github", tags=["auth"])

REDIRECT_URI = "http://127.0.0.1:8000/auth/github/callback"

# In-memory state store for now — good enough for local dev, not for production
_pending_states: set[str] = set()


@router.get("/login")
def login():
    state = secrets.token_urlsafe(16)
    _pending_states.add(state)
    url = build_authorize_url(REDIRECT_URI, state)
    return RedirectResponse(url)


@router.get("/callback")
async def callback(code: str, state: str, db: Session = Depends(get_db)):
    if state not in _pending_states:
        raise HTTPException(status_code=400, detail="Invalid or expired state")
    _pending_states.discard(state)

    access_token = await exchange_code_for_token(code)
    github_user = await get_github_user(access_token)

    existing = db.query(User).filter(User.github_id == str(github_user["id"])).first()
    if existing:
        existing.github_access_token = access_token
        db.commit()
        return {"message": "Logged in", "user_id": str(existing.id), "github_login": github_user["login"]}

    new_user = User(
        github_id=str(github_user["id"]),
        email=github_user.get("email"),
        github_access_token=access_token,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created", "user_id": str(new_user.id), "github_login": github_user["login"]}