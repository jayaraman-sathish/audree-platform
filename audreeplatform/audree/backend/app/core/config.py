import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg2://audree:audree@localhost:5432/audree",
    )
    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-secret-change-me-audree")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12

    class Config:
        env_file = ".env"


settings = Settings()
