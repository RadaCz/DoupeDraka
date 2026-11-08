"""add energy ledger and model tier

Paid turn currency ("Mana") lives in tenths so it never drifts like a float, and
is kept separate from CharacterState.mana, which is the mechanical spell pool.

Revision ID: 5c5b7e017f44
Revises: cd64a95bf304
Create Date: 2026-11-05 22:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5c5b7e017f44"
down_revision = "cd64a95bf304"
branch_labels = None
depends_on = None


def _columns(bind, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _tables(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()

    # A development database may already carry these columns if the app created
    # its tables before this migration existed, so add only what is missing.
    columns = _columns(bind, "users")
    if "model_tier" not in columns:
        op.add_column(
            "users",
            sa.Column("model_tier", sa.String(length=16), nullable=False, server_default="normal"),
        )
    if "energy_tenths" not in columns:
        op.add_column(
            "users",
            sa.Column("energy_tenths", sa.Integer(), nullable=False, server_default="358"),
        )

    if "energy_transactions" not in _tables(bind):
        op.create_table(
            "energy_transactions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("amount_tenths", sa.Integer(), nullable=False),
            sa.Column("reason", sa.String(length=32), nullable=False),
            sa.Column("detail", sa.String(length=128), nullable=False, server_default=""),
            sa.Column("balance_after", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        )
        op.create_index(
            op.f("ix_energy_transactions_user_id"),
            "energy_transactions",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_energy_transactions_created_at"),
            "energy_transactions",
            ["created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if "energy_transactions" in _tables(bind):
        op.drop_index(op.f("ix_energy_transactions_created_at"), table_name="energy_transactions")
        op.drop_index(op.f("ix_energy_transactions_user_id"), table_name="energy_transactions")
        op.drop_table("energy_transactions")

    columns = _columns(bind, "users")
    if "energy_tenths" in columns:
        op.drop_column("users", "energy_tenths")
    if "model_tier" in columns:
        op.drop_column("users", "model_tier")
