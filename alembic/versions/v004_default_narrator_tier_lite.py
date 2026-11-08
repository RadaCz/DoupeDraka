"""Default new users to lite narrator tier (GDS01 E2)."""

from alembic import op
import sqlalchemy as sa

revision = "v004"
down_revision = "v003"
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
