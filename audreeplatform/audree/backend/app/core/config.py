import os
from pydantic_settings import BaseSettings


def _normalize_db_url(url: str) -> str:
    """Render (and Heroku-style) providers hand out DATABASE_URL as
    'postgres://...' or plain 'postgresql://...'. SQLAlchemy 1.4+/2.0 no
    longer recognizes the 'postgres' dialect name and needs the explicit
    psycopg2 driver in the scheme, so normalize whatever we're given."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


class Settings(BaseSettings):
    database_url: str = _normalize_db_url(
        os.environ.get(
            "DATABASE_URL",
            "postgresql+psycopg2://audree:audree@localhost:5432/audree",
        )
    )
    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-secret-change-me-audree")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12

    class Config:
        env_file = ".env"


settings = Settings()
