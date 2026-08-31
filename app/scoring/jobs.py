import httpx
from app.config import settings


async def search_adzuna(query: str, location: str = "", country: str = "us") -> list[dict]:
    """Adzuna: real global listings + salary data. Free tier: 1000 calls/month.
    Note: 'where' must be a real place (city/country) - Adzuna has no 'remote' location filter,
    so remote-style searches just omit location and rely on the query text instead."""
    params = {
        "app_id": settings.adzuna_app_id,
        "app_key": settings.adzuna_app_key,
        "what": query,
        "results_per_page": 10,
    }
    if location and location.lower() != "remote":
        params["where"] = location

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"https://api.adzuna.com/v1/api/jobs/{country}/search/1",
            params=params,
        )
        response.raise_for_status()
        data = response.json()

    return [
        {
            "title": job.get("title"),
            "company": job.get("company", {}).get("display_name"),
            "location": job.get("location", {}).get("display_name"),
            "url": job.get("redirect_url"),
            "salary": job.get("salary_min"),
            "source": "Adzuna",
        }
        for job in data.get("results", [])
    ]


async def search_remoteok(query: str) -> list[dict]:
    """RemoteOK: free, no auth, remote-focused listings.
    Matches on individual query words against position/tags, not the exact phrase,
    since tags are often abbreviated (e.g. 'backend', 'python') rather than full job titles."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get("https://remoteok.com/api", headers={"User-Agent": "career-coach-app"})
        response.raise_for_status()
        data = response.json()

        query_words = [w for w in query.lower().split() if len(w) > 2]
    results = []
    for job in data:
        if not isinstance(job, dict) or "position" not in job:
            continue
        title = job.get("position", "").lower()
        if all(word in title for word in query_words):
            results.append({
                "title": job.get("position"),
                "company": job.get("company"),
                "location": "Remote",
                "url": job.get("url"),
                "salary": job.get("salary_min"),
                "source": "RemoteOK",
            })
    return results[:10]


async def search_arbeitnow(query: str) -> list[dict]:
    """Arbeitnow: free, no auth, strong European/remote coverage."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get("https://www.arbeitnow.com/api/job-board-api")
        response.raise_for_status()
        data = response.json()

    query_lower = query.lower()
    results = []
    for job in data.get("data", []):
        if query_lower in job.get("title", "").lower():
            results.append({
                "title": job.get("title"),
                "company": job.get("company_name"),
                "location": job.get("location") or ("Remote" if job.get("remote") else ""),
                "url": job.get("url"),
                "salary": None,
                "source": "Arbeitnow",
            })
    return results[:10]


async def search_all_jobs(query: str, location: str = "") -> list[dict]:
    """Combine all three sources, tolerate individual failures gracefully."""
    import asyncio

    results = await asyncio.gather(
        search_adzuna(query, location),
        search_remoteok(query),
        search_arbeitnow(query),
        return_exceptions=True,
    )

    combined = []
    for r in results:
        if isinstance(r, list):
            combined.extend(r)
        else:
            print(f"Job search source failed: {r}")

    return combined