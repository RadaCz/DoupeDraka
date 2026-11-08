import json
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .db_types import JsonMetadata
from .engine.economy import STARTING_BALANCE_TENTHS
from .settings import get_settings

CHARACTER_PAYLOAD_SCHEMA_VERSION = 1


def build_async_engine() -> AsyncEngine:
    settings = get_settings()
    url = settings.database_url
    kwargs: dict = {}
    if url.startswith("postgresql"):
        kwargs["pool_size"] = settings.db_pool_size
        kwargs["max_overflow"] = settings.db_max_overflow
        kwargs["pool_pre_ping"] = True
    return create_async_engine(url, **kwargs)


engine = build_async_engine()
Session = async_sessionmaker(engine, expire_on_commit=False)
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(128))
    # Set when the account was created through Telegram Mini App initData. Nullable
    # because locally registered accounts predate it.
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True, nullable=True)
    model_tier: Mapped[str] = mapped_column(String(16), default="lite")
    # Paid turn currency in tenths. Separate from CharacterState.mana (spell pool).
    energy_tenths: Mapped[int] = mapped_column(Integer, default=STARTING_BALANCE_TENTHS)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
class EnergyTransaction(Base):
    __tablename__ = "energy_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    amount_tenths: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str] = mapped_column(String(128), default="")
    balance_after: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
class ApiKey(Base):
    __tablename__ = "api_keys"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
class CharacterRecord(Base):
    __tablename__ = "characters"
    id: Mapped[str] = mapped_column(String(36), primary_key=True); owner_id: Mapped[int] = mapped_column(Integer, index=True); payload: Mapped[str] = mapped_column(Text)
    # Optimistic concurrency guard. Every accepted turn claims the row at the
    # version it read, so a second writer holding a stale copy writes nothing.
    version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
class ActionReceipt(Base):
    """One row per accepted turn, keyed by the client's Idempotency-Key.

    Written in the same commit as the turn it describes, so a retry finds the
    result instead of rolling the dice again and charging a second time.
    """
    __tablename__ = "action_receipts"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int] = mapped_column(Integer, index=True)
    character_id: Mapped[str] = mapped_column(String(36), index=True)
    # committed = state + ledger + event are durable; complete = narration landed.
    status: Mapped[str] = mapped_column(String(16), default="committed")
    response: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, default=lambda: datetime.utcnow() + timedelta(hours=24), index=True
    )
class EventRecord(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True); character_id: Mapped[str] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(Text); result: Mapped[str] = mapped_column(Text); created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

class AnalyticsEvent(Base):
    """Lightweight product telemetry (first-party, no third-party analytics)."""

    __tablename__ = "analytics_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    character_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JsonMetadata, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
async def init_db() -> None:
    # Local SQLite development database; production PostgreSQL needs no directory.
    if get_settings().database_url.startswith("sqlite"):
        Path("data").mkdir(exist_ok=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.run_sync(_migrate_character_version)
        await connection.run_sync(_migrate_action_receipt_expiry)

def _migrate_character_version(connection) -> None:
    """Add characters.version to a database created before STEP 1.

    create_all creates missing tables but never adds a column to an existing
    one, and dropping the table would take the player's characters with it, so
    the column is added in place and existing rows start at version 0.
    """
    if connection.dialect.name != "sqlite":
        return
    columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(characters)").fetchall()}
    if columns and "version" not in columns:
        connection.exec_driver_sql("ALTER TABLE characters ADD COLUMN version INTEGER NOT NULL DEFAULT 0")

def _migrate_action_receipt_expiry(connection) -> None:
    """Add the 24-hour idempotency expiry to databases initialized before Alembic."""
    if connection.dialect.name != "sqlite":
        return
    columns = {
        row[1]
        for row in connection.exec_driver_sql("PRAGMA table_info(action_receipts)").fetchall()
    }
    if not columns:
        return
    if "expires_at" not in columns:
        connection.exec_driver_sql("ALTER TABLE action_receipts ADD COLUMN expires_at DATETIME")
    connection.exec_driver_sql(
        "UPDATE action_receipts "
        "SET expires_at = datetime(created_at, '+24 hours') "
        "WHERE expires_at IS NULL AND created_at IS NOT NULL"
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_action_receipts_expires_at "
        "ON action_receipts (expires_at)"
    )

def encode_state(data: dict) -> str: return json.dumps(data, ensure_ascii=False)
def decode_state(data: str) -> dict: return json.loads(data)

def encode_character_state(data: dict) -> str:
    payload = dict(data)
    payload["schema_version"] = CHARACTER_PAYLOAD_SCHEMA_VERSION
    return encode_state(payload)

def decode_character_state(payload: str) -> dict:
    state = decode_state(payload)
    schema_version = state.pop("schema_version", 0)
    if not isinstance(schema_version, int) or schema_version < 0:
        raise ValueError("Invalid character payload schema version")
    if schema_version > CHARACTER_PAYLOAD_SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported character payload schema version: {schema_version}"
        )
    return state
