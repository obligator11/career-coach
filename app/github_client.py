import httpx
from app.config import settings

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_URL = "https://api.github.com"


def build_authorize_url(redirect_uri: str, state: str) -> str:
    params = (
        f"client_id={settings.github_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=repo"
        f"&state={state}"
    )
    return f"{GITHUB_AUTHORIZE_URL}?{params}"


async def exchange_code_for_token(code: str) -> str:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()
        if "access_token" not in data:
            raise ValueError(f"GitHub token exchange failed: {data}")
        return data["access_token"]


async def get_github_user(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API_URL}/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        response.raise_for_status()
        return response.json()