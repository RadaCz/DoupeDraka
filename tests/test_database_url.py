from app.database_url import normalize_database_url


def test_normalize_postgresql_url():
    assert (
        normalize_database_url("postgresql://user:pass@host:5432/db")
        == "postgresql+asyncpg://user:pass@host:5432/db"
    )


def test_normalize_postgres_scheme():
    assert (
        normalize_database_url("postgres://user:pass@host:5432/db")
        == "postgresql+asyncpg://user:pass@host:5432/db"
    )


def test_leaves_asyncpg_and_sqlite_unchanged():
    async_url = "postgresql+asyncpg://user:pass@host:5432/db"
    sqlite_url = "sqlite+aiosqlite:///./data/dnd.db"
    assert normalize_database_url(async_url) == async_url
    assert normalize_database_url(sqlite_url) == sqlite_url