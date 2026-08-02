# AI Career & Portfolio Coach

> 🚧 **Under active development.** This is a work-in-progress build — expect frequent commits, incomplete features, and evolving architecture as each phase lands.

## About

A platform that connects to a developer's GitHub account and continuously analyzes their commit history over time — not a one-off resume review. It tracks what skills a developer is *actually demonstrating* through their code, flags when a portfolio goes stale, and generates a personalized roadmap of next projects to close specific skill gaps.

Built as a deep-dive Python portfolio project: FastAPI backend, RQ/Redis background workers, PostgreSQL + pgvector, a hybrid deterministic-then-LLM skill scoring pipeline (local-first via Ollama), and a React + TypeScript dashboard.

## Status

| Phase | Status |
|---|---|
| 0 — Environment setup | ✅ Done |
| 1 — GitHub ingestion & storage | ✅ Done |
| 2 — Deterministic scoring | ⬜ Not started |
| 3 — LLM skill scoring | ⬜ Not started |
| 4 — Roadmap engine | ⬜ Not started |
| 5 — Dashboard | ⬜ Not started |
| 6 — Production hardening | ⬜ Not started |

## Stack

Python 3.11 · FastAPI · SQLAlchemy · PostgreSQL + pgvector · Redis + RQ · Ollama (local LLM) · React + TypeScript · Docker Compose

## Running locally

```bash
docker compose up -d      # postgres + redis
conda activate career-coach
uvicorn app.main:app --reload
```

(Details will expand as each phase is built out.)
