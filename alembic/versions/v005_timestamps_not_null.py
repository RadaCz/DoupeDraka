"""Backfill NULL timestamp columns and enforce NOT NULL to match ORM models."""

from alembic import op
import sqlalchemy as sa

revision = "v005"
down_revision = "v004"
branch_labels = None
depends_on = None

_TIMESTAMP_COLUMNS: tuple[tuple[str, str], ...] = (
    ("users", "created_at"),
    ("energy_transactions", "created_at"),
    ("api_keys", "created_at"),
    ("characters", "updated_at"),
    ("action_receipts", "created_at"),
    ("analytics_events", "created_at"),
    ("events", "created_at"),
)


def _backfill_nulls(connection) -> None:
    for table, column in _TIMESTAMP_COLUMNS:
        connection.execute(
            sa.text(f'UPDATE "{table}" SET "{column}" = CURRENT_TIMESTAMP WHERE "{column}" IS NULL')
        )


def upgrade() -> None:
    connection = op.get_bind()
    _backfill_nulls(connection)
    for table, column in _TIMESTAMP_COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=sa.DateTime(),
            nullable=False,
        )


def downgrade() -> None:
    for table, column in _TIMESTAMP_COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=sa.DateTime(),
            nullable=True,
        )
