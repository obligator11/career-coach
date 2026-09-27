import httpx
import json
import re
import asyncio
from pydantic import BaseModel
from google import genai
from app.config import settings

from app.scoring.web_search import search_web

OLLAMA_URL = "http://localhost:11434/api/chat"

SEARCH_TRIGGERS = re.compile(
    r"\b(latest|news|new|recent|today|current|update|what'?s happening|what'?s new|"
    r"this week|this month|right now|nowadays|these days)\b",
    re.IGNORECASE,
)

def needs_web_search(text: str) -> bool:
    """Simple keyword heuristic - not perfect, but catches the clear cases
    ('what's the latest', 'any news about', etc.) without needing a separate
    LLM call just to decide whether to search."""
    return bool(SEARCH_TRIGGERS.search(text))

class CoachAdvice(BaseModel):
    message: str


SYSTEM_PROMPT = """You are a warm, direct career coach having a real spoken conversation with a developer.
This is a VOICE conversation - keep replies SHORT (1-2 sentences, rarely 3), natural, like a real person talking casually, not writing an email.
Respond with ONLY a JSON object, no other text:
{"message": "your spoken reply"}
Never use bullet points, headers, or markdown - this will be spoken aloud.
Only bring up specific project suggestions or skill names if the person's question is actually about that topic - don't force unrelated context into every answer.
Vary your phrasing - don't repeat the same project names or observations across different questions unless directly asked.
React directly and specifically to what was just said."""


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
    
    search_context = ""
    if needs_web_search(user_message):
        try:
            search_result = search_web(user_message)
            if search_result.get("answer"):
                search_context = f"\n\nReal-time web search result (use this for accuracy, it's more current than your training data): {search_result['answer']}"
        except Exception as e:
            print(f"Web search failed, continuing without it: {e}")

    prompt_parts = [SYSTEM_PROMPT]
    
    if context:
        prompt_parts.append(f"Known context about this developer: {context}")
        
    if search_context:
        prompt_parts.append(search_context)
        
    if history:
        for turn in history[-6:]:
            prompt_parts.append(f"{turn['role']}: {turn['content']}")
            
    prompt_parts.append(f"user: {user_message}")

    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model="gemini-3.6-flash",
                contents="\n\n".join(prompt_parts),
            ),
            timeout=10.0,
        )
    except asyncio.TimeoutError:
        raise RuntimeError("Gemini timed out - server may be under high load right now")

    raw_text = response.text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").removeprefix("json").strip()

    return CoachAdvice(**json.loads(raw_text))