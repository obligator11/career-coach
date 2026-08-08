from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    github_client_id: str
    github_client_secret: str
    database_url: str
    redis_url: str
    lm_studio_url: str = "http://localhost:1234/v1"

settings = Settings()