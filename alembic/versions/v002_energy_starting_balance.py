"""Update the default Adventure Mana balance for new users.

Revision ID: v002
Revises: v001
"""
from alembic import op
import sqlalchemy as sa


revision = "v002"
down_revision = "v001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "energy_tenths",
            existing_type=sa.Integer(),
            existing_nullable=False,
            server_default="1000",
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "energy_tenths",
            existing_type=sa.Integer(),
            existing_nullable=False,
            server_default="358",
        )
