"""Persist structured turn resolution on journal events.

Revision ID: v006
Revises: v005
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v006"
down_revision = "v005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    metadata_type = postgresql.JSONB(astext_type=sa.Text()) if bind.dialect.name == "postgresql" else sa.JSON()
    inspector = sa.inspect(bind)
    if "events" not in inspector.get_table_names():
        return
    columns = {row["name"] for row in inspector.get_columns("events")}
    if "resolution_json" in columns:
        return
    op.add_column(
        "events",
        sa.Column("resolution_json", metadata_type, nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if "events" not in sa.inspect(bind).get_table_names():
        return
    columns = {row["name"] for row in sa.inspect(bind).get_columns("events")}
    if "resolution_json" not in columns:
        return
    op.drop_column("events", "resolution_json")