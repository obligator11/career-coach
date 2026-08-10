from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from app.models.models import SkillTaxonomy, SkillScore

_model = None


def get_embedding_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


SEED_SKILLS = [
    "Python programming", "TypeScript programming", "JavaScript programming",
    "SQL and database queries", "Database schema design", "Database migrations",
    "REST API design", "API integration", "OAuth authentication",
    "Containerization", "Docker orchestration", "CI/CD pipelines",
    "Background job processing", "Multi-agent system design",
    "LLM prompt engineering", "Vector search and embeddings",
    "Frontend UI development", "Data validation", "Testing and QA",
    "DevOps and infrastructure", "Documentation writing",
    "Project setup and scaffolding", "Version control practices",
]


def seed_taxonomy(db: Session) -> int:
    """Populate skill_taxonomy with a curated seed list, embedding each one."""
    model = get_embedding_model()
    existing_names = {row.canonical_name for row in db.query(SkillTaxonomy).all()}

    added = 0
    for skill in SEED_SKILLS:
        if skill in existing_names:
            continue
        vec = model.encode(skill).tolist()
        db.add(SkillTaxonomy(canonical_name=skill, embedding=vec))
        added += 1

    db.commit()
    return added


def match_skill_to_taxonomy(db: Session, raw_skill_name: str, similarity_threshold: float = 0.45):
    """Find the closest taxonomy entry for a raw skill name using cosine distance.
    Returns the SkillTaxonomy row, or None if nothing is close enough."""
    model = get_embedding_model()
    vec = model.encode(raw_skill_name).tolist()

    result = db.execute(
        text("""
            SELECT id, canonical_name, embedding <=> CAST(:vec AS vector) AS distance
            FROM skill_taxonomy
            ORDER BY distance ASC
            LIMIT 1
        """),
        {"vec": str(vec)},
    ).first()

    if result is None:
        return None

    if result.distance > similarity_threshold:
        return None

    return db.query(SkillTaxonomy).filter(SkillTaxonomy.id == result.id).first()


def normalize_all_skill_scores(db: Session, user) -> list[dict]:
    """Go through this user's skill_scores and link each to a canonical taxonomy entry."""
    scores = db.query(SkillScore).filter(SkillScore.user_id == user.id).all()

    results = []
    for score in scores:
        match = match_skill_to_taxonomy(db, score.skill_name)
        if match:
            score.canonical_skill_id = match.id
            results.append({"raw": score.skill_name, "matched_to": match.canonical_name})
        else:
            results.append({"raw": score.skill_name, "matched_to": None})

    db.commit()
    return results