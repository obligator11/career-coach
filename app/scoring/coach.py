import httpx
import json
from pydantic import BaseModel

OLLAMA_URL = "http://localhost:11434/api/chat"


class CoachAdvice(BaseModel):
    message: str


SYSTEM_PROMPT = """You are a friendly, encouraging career coach talking to a developer about their GitHub activity.
Respond with ONLY a JSON object, no other text:
{"message": "your advice, 1-2 short sentences, warm and specific, like a real coach talking"}
Be concrete - reference the actual skill or project mentioned. Keep it conversational, not corporate."""


async def get_coach_advice(context: str) -> CoachAdvice:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": "llama3.1:latest",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": context},
                ],
                "stream": False,
                "format": "json",
            },
        )
        response.raise_for_status()
        raw_text = response.json()["message"]["content"]

    return CoachAdvice(**json.loads(raw_text))