from fastapi import FastAPI
from app.routers import auth, dashboard

app = FastAPI(title="AI Career & Portfolio Coach")

app.include_router(auth.router)
app.include_router(dashboard.router)


@app.get("/")
def root():
    return {"status": "ok"}