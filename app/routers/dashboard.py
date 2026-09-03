from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, Repo, SkillScore, SkillTaxonomy, RoadmapItem, UserPreferences

from app.scoring.coach import get_coach_advice, get_coach_advice_gemini
import asyncio

from fastapi.responses import Response
from app.scoring.voice import generate_speech

from app.scoring.jobs import search_all_jobs
from app.models.models import JobApplication

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


@router.get("/preferences")
def get_preferences(user_id: str, db: Session = Depends(get_db)):
    user = get_current_user(user_id, db)
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user.id).first()
    if not prefs:
        return {"exists": False}
    return {
        "exists": True,
        "assistant_name": prefs.assistant_name or "Nova",
        "degree_field": prefs.degree_field,
        "target_roles": prefs.target_roles,
        "preferred_locations": prefs.preferred_locations,
        "remote_preference": prefs.remote_preference,
        "experience_level": prefs.experience_level,
    }


@router.post("/preferences")
def save_preferences(
    user_id: str,
    assistant_name: str,
    degree_field: str,
    target_roles: str,
    preferred_locations: str,
    remote_preference: str,
    experience_level: str,
    db: Session = Depends(get_db),
):
    user = get_current_user(user_id, db)
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user.id).first()
    if prefs:
        prefs.assistant_name = assistant_name
        prefs.degree_field = degree_field
        prefs.target_roles = target_roles
        prefs.preferred_locations = preferred_locations
        prefs.remote_preference = remote_preference
        prefs.experience_level = experience_level
    else:
        prefs = UserPreferences(
            user_id=user.id,
            assistant_name=assistant_name,
            degree_field=degree_field,
            target_roles=target_roles,
            preferred_locations=preferred_locations,
            remote_preference=remote_preference,
            experience_level=experience_level,
        )
        db.add(prefs)
    db.commit()
    return {"status": "saved"}




@router.get("/jobs")
async def get_jobs(user_id: str, db: Session = Depends(get_db)):
    user = get_current_user(user_id, db)
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user.id).first()

    if not prefs or not prefs.target_roles:
        return {"jobs": [], "message": "No preferences saved yet - set your target roles first."}

    roles = [r.strip() for r in prefs.target_roles.split(",") if r.strip()]
    location = ""
    if prefs.preferred_locations:
        first_location = prefs.preferred_locations.split(",")[0].strip()
        if first_location.lower() != "remote":
            location = first_location

    seen_titles = set()
    saved_jobs = []
    for role in roles[:3]:
        results = await search_all_jobs(role, location)
        for job in results:
            key = f"{job['title']}|{job['company']}"
            if key in seen_titles:
                continue
            seen_titles.add(key)

            existing = (
                db.query(JobApplication)
                .filter(JobApplication.user_id == user.id, JobApplication.title == job["title"], JobApplication.company == job["company"])
                .first()
            )
            if existing:
                saved_jobs.append(existing)
                continue

            new_job = JobApplication(
                user_id=user.id,
                title=job["title"],
                company=job.get("company"),
                location=job.get("location"),
                url=job.get("url"),
                source=job.get("source"),
                status="found",
            )
            db.add(new_job)
            db.flush()
            saved_jobs.append(new_job)

    db.commit()

    return {
        "jobs": [
            {
                "id": str(j.id),
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "url": j.url,
                "source": j.source,
                "status": j.status,
            }
            for j in saved_jobs[:20]
        ],
        "searched_roles": roles[:3],
    }


@router.get("/jobs/saved")
def get_saved_jobs(user_id: str, db: Session = Depends(get_db)):
    """Just return what's already in the DB, no new API calls - for quick reloads."""
    user = get_current_user(user_id, db)
    jobs = db.query(JobApplication).filter(JobApplication.user_id == user.id).order_by(JobApplication.created_at.desc()).all()
    return [
        {"id": str(j.id), "title": j.title, "company": j.company, "location": j.location, "url": j.url, "source": j.source, "status": j.status}
        for j in jobs
    ]


@router.post("/jobs/{job_id}/status")
def update_job_status(job_id: str, status: str, user_id: str, db: Session = Depends(get_db)):
    user = get_current_user(user_id, db)
    job = db.query(JobApplication).filter(JobApplication.id == job_id, JobApplication.user_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = status
    db.commit()
    return {"status": "updated"}