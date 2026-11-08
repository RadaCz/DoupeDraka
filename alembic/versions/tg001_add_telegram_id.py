"""add telegram identity to users

Telegram Mini App identity is delegated to Telegram itself: `initData` is signed
with the bot token, so `telegram_id` is a trustworthy primary identity. It is
nullable because locally registered accounts predate it.

Revision ID: tg001
Revises: 5c5b7e017f44
Create Date: 2026-11-06 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "tg001"
down_revision = "5c5b7e017f44"
branch_labels = None
depends_on = None


def _columns(bind, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _indexes(bind, table: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table)}


def upgrade() -> None:
    bind = op.get_bind()
    # A development database may already carry the column if the app created its
    # tables before this revision existed, so add only what is missing.
    if "telegram_id" not in _columns(bind, "users"):
        op.add_column("users", sa.Column("telegram_id", sa.BigInteger(), nullable=True))
    if "ix_users_telegram_id" not in _indexes(bind, "users"):
        op.create_index(op.f("ix_users_telegram_id"), "users", ["telegram_id"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    if "ix_users_telegram_id" in _indexes(bind, "users"):
        op.drop_index(op.f("ix_users_telegram_id"), table_name="users")
    if "telegram_id" in _columns(bind, "users"):
        op.drop_column("users", "telegram_id")