from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, Repo, SkillScore, SkillTaxonomy, RoadmapItem

from app.scoring.coach import get_coach_advice
import asyncio

from fastapi.responses import Response
from app.scoring.voice import generate_speech

from app.scoring.coach import get_coach_advice, get_coach_advice_gemini

router = APIRouter(prefix="/me", tags=["dashboard"])


def get_current_user(user_id: str, db: Session = Depends(get_db)) -> User:
    """Temporary: pass user_id as a query param until real session auth exists."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/skills")
def get_skills(user_id: str, db: Session = Depends(get_db)):
    user = get_current_user(user_id, db)
    scored = (
        db.query(SkillScore, SkillTaxonomy)
        .join(SkillTaxonomy, SkillScore.canonical_skill_id == SkillTaxonomy.id)
        .filter(SkillScore.user_id == user.id)
        .all()
    )
    best_per_skill = {}
    for score_row, taxonomy_row in scored:
        name = taxonomy_row.canonical_name
        if name not in best_per_skill or score_row.score > best_per_skill[name]:
            best_per_skill[name] = round(score_row.score, 3)

    return [{"skill": name, "score": score} for name, score in sorted(best_per_skill.items(), key=lambda x: -x[1])]


@router.get("/roadmap")
def get_roadmap(user_id: str, db: Session = Depends(get_db)):
    user = get_current_user(user_id, db)
    items = db.query(RoadmapItem).filter(RoadmapItem.user_id == user.id).all()
    return [
        {
            "id": str(item.id),
            "title": item.title,
            "description": item.description,
            "target_skill": item.target_skill,
            "status": item.status,
        }
        for item in items
    ]


@router.get("/repos")
def get_repos(user_id: str, db: Session = Depends(get_db)):
    user = get_current_user(user_id, db)
    repos = db.query(Repo).filter(Repo.user_id == user.id).all()
    return [
        {"name": r.name, "last_synced_at": r.last_synced_at.isoformat() if r.last_synced_at else None}
        for r in repos
    ]


@router.get("/summary")
def get_summary(user_id: str, db: Session = Depends(get_db)):
    """One combined payload - exactly what the office UI will load on startup."""
    return {
        "skills": get_skills(user_id, db),
        "roadmap": get_roadmap(user_id, db),
        "repos": get_repos(user_id, db),
    }


@router.get("/coach-advice")
def coach_advice(user_id: str, topic: str, history: str = "[]", mode: str = "local", db: Session = Depends(get_db)):
    user = get_current_user(user_id, db)
    try:
        import json
        parsed_history = json.loads(history)

        scored = (
            db.query(SkillScore, SkillTaxonomy)
            .join(SkillTaxonomy, SkillScore.canonical_skill_id == SkillTaxonomy.id)
            .filter(SkillScore.user_id == user.id)
            .all()
        )
        top_skills = sorted(
            {t.canonical_name: s.score for s, t in scored}.items(),
            key=lambda x: -x[1]
        )[:3]
        roadmap = db.query(RoadmapItem).filter(RoadmapItem.user_id == user.id).all()

        context = (
            f"Top skills: {', '.join(f'{name} ({score:.2f})' for name, score in top_skills)}. "
            f"Suggested next projects: {', '.join(r.title for r in roadmap[:2])}."
        )

        if mode == "gemini":
            advice = asyncio.run(get_coach_advice_gemini(topic, context=context, history=parsed_history))
        else:
            advice = asyncio.run(get_coach_advice(topic, context=context, history=parsed_history))

        return {"message": advice.message}
    except Exception as e:
        print(f"Coach advice failed: {e}")
        return {"message": "Keep going - every commit counts."}


@router.get("/coach-voice")
def coach_voice(text: str):
    audio_bytes = generate_speech(text, voice="af_sky")
    return Response(content=audio_bytes, media_type="audio/wav")