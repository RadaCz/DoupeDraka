"""add token_hash to api_keys

Revision ID: cd64a95bf304
Revises: auth001
Create Date: 2026-11-05 00:00:00.000000

"""
import hashlib

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "cd64a95bf304"
down_revision = "auth001"
branch_labels = None
depends_on = None


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def upgrade() -> None:
    op.create_table(
        "api_keys_new",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("token_hash"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT token, user_id, created_at FROM api_keys")).fetchall()
    for token, user_id, created_at in rows:
        if not token or not isinstance(token, str):
            continue
        token_hash = _hash_token(token.strip())
        conn.execute(
            sa.text(
                "INSERT INTO api_keys_new (token_hash, user_id, created_at) "
                "VALUES (:token_hash, :user_id, :created_at)"
            ),
            {"token_hash": token_hash, "user_id": user_id, "created_at": created_at},
        )

    op.drop_table("api_keys")
    op.rename_table("api_keys_new", "api_keys")


def downgrade() -> None:
    op.create_table(
        "api_keys_old",
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("token"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT token_hash, user_id, created_at FROM api_keys")).fetchall()
    for token_hash, user_id, created_at in rows:
        conn.execute(
            sa.text(
                "INSERT INTO api_keys_old (token, user_id, created_at) "
                "VALUES (:token, :user_id, :created_at)"
            ),
            {"token": token_hash, "user_id": user_id, "created_at": created_at},
        )

    op.drop_table("api_keys")
    op.rename_table("api_keys_old", "api_keys")
