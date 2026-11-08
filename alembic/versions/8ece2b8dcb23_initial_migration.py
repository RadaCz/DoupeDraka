"""Create migration.

Revision ID: 8ece2b8dcb23
Revises: 
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8ece2b8dcb23"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "characters",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_characters_owner_id"), "characters", ["owner_id"], unique=False)
    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("result", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_events_character_id"), "events", ["character_id"], unique=False)
    op.create_index(op.f("ix_events_created_at"), "events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_events_created_at"), table_name="events")
    op.drop_index(op.f("ix_events_character_id"), table_name="events")
    op.drop_table("events")
    op.drop_index(op.f("ix_characters_owner_id"), table_name="characters")
    op.drop_table("characters")
