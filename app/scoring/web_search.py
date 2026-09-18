from tavily import TavilyClient
from app.config import settings


def search_web(query: str, max_results: int = 3) -> list[dict]:
    """Real-time web search via Tavily. Returns clean, LLM-ready results."""
    client = TavilyClient(api_key=settings.tavily_api_key)
    response = client.search(query=query, max_results=max_results, include_answer=True)

    results = [
        {"title": r.get("title"), "content": r.get("content"), "url": r.get("url")}
        for r in response.get("results", [])
    ]

    return {
        "answer": response.get("answer"),
        "results": results,
    }
