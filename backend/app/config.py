from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite+aiosqlite:///./visits.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]
    app_env: str = "development"
    feedback_to: str = "kginatsu@gmail.com"
    feedback_from: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    ai_enabled: bool = False
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"


@lru_cache
def get_settings() -> Settings:
    return Settings()
