"""Default new users to lite narrator tier (GDS01 E2)."""

from alembic import op
import sqlalchemy as sa

revision = "v004_default_narrator_tier_lite"
down_revision = "v003_analytics_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "model_tier",
        existing_type=sa.String(length=16),
        server_default="lite",
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "model_tier",
        existing_type=sa.String(length=16),
        server_default="normal",
    )
