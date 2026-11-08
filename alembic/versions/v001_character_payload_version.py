"""add character row version and payload schema marker support

Revision ID: v001
Revises: f6a1e2c9b041
Create Date: 2026-11-06 22:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "v001"
down_revision = "f6a1e2c9b041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("characters")}
    if "version" not in columns:
        op.add_column(
            "characters",
            sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("characters")}
    if "version" in columns:
        op.drop_column("characters", "version")
