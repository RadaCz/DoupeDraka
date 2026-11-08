"""expire action idempotency receipts after 24 hours

Revision ID: f6a1e2c9b041
Revises: 5c5b7e017f44
Create Date: 2026-11-06 22:15:00.000000

"""
from datetime import datetime, timedelta

from alembic import op
import sqlalchemy as sa


revision = "f6a1e2c9b041"
down_revision = "tg001"
branch_labels = None
depends_on = None


def _tables(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    if "action_receipts" not in _tables(bind):
        op.create_table(
            "action_receipts",
            sa.Column("key", sa.String(length=64), nullable=False),
            sa.Column("owner_id", sa.Integer(), nullable=False),
            sa.Column("character_id", sa.String(length=36), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="committed"),
            sa.Column("response", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("key"),
        )
    else:
        columns = {column["name"] for column in sa.inspect(bind).get_columns("action_receipts")}
        if "expires_at" not in columns:
            op.add_column(
                "action_receipts",
                sa.Column("expires_at", sa.DateTime(), nullable=True),
            )

        receipt_table = sa.table(
            "action_receipts",
            sa.column("key", sa.String(length=64)),
            sa.column("created_at", sa.DateTime()),
            sa.column("expires_at", sa.DateTime()),
        )
        for key, created_at in bind.execute(
            sa.select(receipt_table.c.key, receipt_table.c.created_at).where(
                receipt_table.c.expires_at.is_(None)
            )
        ):
            expiry = (
                created_at + timedelta(hours=24)
                if created_at is not None
                else datetime.utcnow() - timedelta(seconds=1)
            )
            bind.execute(
                sa.update(receipt_table)
                .where(receipt_table.c.key == key)
                .values(expires_at=expiry)
            )

    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("action_receipts")}
    if "ix_action_receipts_owner_id" not in indexes:
        op.create_index("ix_action_receipts_owner_id", "action_receipts", ["owner_id"])
    if "ix_action_receipts_character_id" not in indexes:
        op.create_index("ix_action_receipts_character_id", "action_receipts", ["character_id"])
    if "ix_action_receipts_created_at" not in indexes:
        op.create_index("ix_action_receipts_created_at", "action_receipts", ["created_at"])
    if "ix_action_receipts_expires_at" not in indexes:
        op.create_index("ix_action_receipts_expires_at", "action_receipts", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_action_receipts_expires_at", table_name="action_receipts")
    op.drop_column("action_receipts", "expires_at")
