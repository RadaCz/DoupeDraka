"""Normalize DATABASE_URL for async SQLAlchemy / Alembic."""


def normalize_database_url(url: str) -> str:
    """Convert Railway-style postgres URLs to the asyncpg driver form."""
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    return url