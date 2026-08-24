import httpx
import json
from pydantic import BaseModel
from google import genai
from app.config import settings

OLLAMA_URL = "http://localhost:11434/api/chat"


class CoachAdvice(BaseModel):
    message: str


SYSTEM_PROMPT = """You are a warm, encouraging career coach having a real spoken conversation with a developer.
This is a VOICE conversation - keep replies SHORT (1-3 sentences), natural, and conversational, like a real person talking, not writing.
Respond with ONLY a JSON object, no other text:
{"message": "your spoken reply"}
Never use bullet points, headers, or markdown - this will be spoken aloud.
React directly and specifically to what the developer just said. Be genuinely helpful, not generic."""


async def get_coach_advice(user_message: str, context: str = "", history: list[dict] | None = None) -> CoachAdvice:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if context:
        messages.append({"role": "system", "content": f"Known context about this developer: {context}"})

    if history:
        for turn in history[-6:]:  # last 3 exchanges, keeps prompt size reasonable
            messages.append(turn)

    messages.append({"role": "user", "content": user_message})

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={"model": "llama3.1:latest", "messages": messages, "stream": False, "format": "json"},
        )
        response.raise_for_status()
        raw_text = response.json()["message"]["content"]

    return CoachAdvice(**json.loads(raw_text))



async def get_coach_advice_gemini(user_message: str, context: str = "", history: list[dict] | None = None) -> CoachAdvice:
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt_parts = [SYSTEM_PROMPT]
    if context:
        prompt_parts.append(f"Known context about this developer: {context}")
    if history:
        for turn in history[-6:]:
            prompt_parts.append(f"{turn['role']}: {turn['content']}")
    prompt_parts.append(f"user: {user_message}")

    response = await client.aio.models.generate_content(
        model="gemini-3.6-flash",
        contents="\n\n".join(prompt_parts),
    )

    raw_text = response.text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").removeprefix("json").strip()

    return CoachAdvice(**json.loads(raw_text))