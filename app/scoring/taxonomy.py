from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
from sqlalchemy import select
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