import json
import httpx
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config import settings
from app.models.models import SkillScore, SkillTaxonomy, RoadmapItem, User

TARGET_ROLES = {
    "AI Engineer": {
        "Python programming": 0.8,
        "LLM prompt engineering": 0.7,
        "Vector search and embeddings": 0.6,
        "API integration": 0.6,
        "Database schema design": 0.5,
        "Testing and QA": 0.5,
        "Multi-agent system design": 0.5,
    },
    "Backend Engineer": {
        "Python programming": 0.8,
        "REST API design": 0.7,
        "Database schema design": 0.7,
        "Database migrations": 0.6,
        "Testing and QA": 0.6,
        "DevOps and infrastructure": 0.5,
    },
}


class RoadmapSuggestion(BaseModel):
    title: str
    description: str


SYSTEM_PROMPT = """You are a career coach suggesting a specific project to help a developer close a skill gap.
Respond with ONLY a JSON object, no other text, matching exactly this shape:
{
  "title": "short project name, 5-8 words",
  "description": "2-3 sentences explaining what to build and why it develops this specific skill"
}
Be concrete and specific - suggest an actual buildable project, not vague advice."""


async def generate_roadmap_suggestion(target_skill: str, current_score: float, target_score: float) -> RoadmapSuggestion:
    gap_desc = f"Current score: {current_score:.2f}, target: {target_score:.2f}" if current_score else "No current evidence of this skill"

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.lm_studio_url}/chat/completions",
            json={
                "model": "qwen/qwen2.5-coder-14b",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Skill gap: {target_skill}\n{gap_desc}"},
                ],
                "temperature": 0.4,
            },
        )
        response.raise_for_status()
        raw_text = response.json()["choices"][0]["message"]["content"]

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").removeprefix("json").strip()

    return RoadmapSuggestion(**json.loads(cleaned))


def generate_roadmap_for_role(db: Session, user: User, role: str) -> list[dict]:
    """Compare user's normalized skills against a target role, generate roadmap items for gaps."""
    if role not in TARGET_ROLES:
        raise ValueError(f"Unknown role: {role}. Available: {list(TARGET_ROLES.keys())}")

    required_skills = TARGET_ROLES[role]

    # Build a lookup of the user's best score per canonical skill
    user_scores = {}
    scored = (
        db.query(SkillScore, SkillTaxonomy)
        .join(SkillTaxonomy, SkillScore.canonical_skill_id == SkillTaxonomy.id)
        .filter(SkillScore.user_id == user.id)
        .all()
    )
    for score_row, taxonomy_row in scored:
        name = taxonomy_row.canonical_name
        if name not in user_scores or score_row.score > user_scores[name]:
            user_scores[name] = score_row.score

    results = []
    for skill, target_score in required_skills.items():
        current = user_scores.get(skill, 0.0)
        if current >= target_score:
            continue  # gap already closed, no roadmap item needed

        import asyncio
        suggestion = asyncio.run(generate_roadmap_suggestion(skill, current, target_score))

        item = RoadmapItem(
            user_id=user.id,
            title=suggestion.title,
            description=suggestion.description,
            target_skill=skill,
            status="suggested",
        )
        db.add(item)
        results.append({
            "target_skill": skill,
            "current_score": current,
            "target_score": target_score,
            "title": suggestion.title,
            "description": suggestion.description,
        })

    db.commit()
    return results