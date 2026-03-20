from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:pass@localhost/windforecast"
    redis_url: str = "redis://localhost:6379"
    cache_ttl: int = 300  # seconds
    elexon_timeout: int = 30
    elexon_api_key: str | None = None
    cors_origins: list[str] = ["http://localhost:3000", "https://your-app.vercel.app"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()