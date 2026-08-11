import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from pgvector.sqlalchemy import Vector

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    github_id = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=True)
    github_access_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Repo(Base):
    __tablename__ = "repos"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    github_repo_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    last_synced_at = Column(DateTime, nullable=True)

class Commit(Base):
    __tablename__ = "commits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_id = Column(UUID(as_uuid=True), ForeignKey("repos.id"), nullable=False)
    sha = Column(String, nullable=False)
    message = Column(String, nullable=False)
    diff_summary = Column(String, nullable=True)
    committed_at = Column(DateTime, nullable=False)
    raw_metadata = Column(JSON, nullable=True)


class SkillScore(Base):
    __tablename__ = "skill_scores"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    skill_name = Column(String, nullable=False)
    canonical_skill_id = Column(UUID(as_uuid=True), ForeignKey("skill_taxonomy.id"), nullable=True)
    score = Column(Float, nullable=False)
    evidence_commit_id = Column(UUID(as_uuid=True), ForeignKey("commits.id"), nullable=True)
    computed_at = Column(DateTime, default=datetime.utcnow)


class SkillTaxonomy(Base):
    __tablename__ = "skill_taxonomy"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_name = Column(String, unique=True, nullable=False)
    embedding = Column(Vector(384), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class RoadmapItem(Base):
    __tablename__ = "roadmap_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    target_skill = Column(String, nullable=False)
    status = Column(String, default="suggested")
    created_at = Column(DateTime, default=datetime.utcnow)