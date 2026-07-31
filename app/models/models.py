import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    github_id = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=True)
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