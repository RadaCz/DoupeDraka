"""add token_hash to api_keys

Revision ID: cd64a95bf304
Revises: auth001
Create Date: 2026-11-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "cd64a95bf304"
down_revision = "auth001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite doesn't support dropping PRIMARY KEY columns directly
    # We need to recreate the table with the new schema
    
    # Create new table with token_hash as primary key
    op.create_table(
        "api_keys_new",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("token_hash"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    
    # Copy data from old table (copy token to token_hash for backward compatibility)
    op.execute("INSERT INTO api_keys_new (token_hash, user_id, created_at) SELECT token, user_id, created_at FROM api_keys")
    
    # Drop old table
    op.drop_table("api_keys")
    
    # Rename new table
    op.rename_table("api_keys_new", "api_keys")


def downgrade() -> None:
    # Recreate old table
    op.create_table(
        "api_keys_old",
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("token"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    
    # Copy data back
    op.execute("INSERT INTO api_keys_old (token, user_id, created_at) SELECT token_hash, user_id, created_at FROM api_keys")
    
    # Drop new table
    op.drop_table("api_keys")
    
    # Rename old table
    op.rename_table("api_keys_old", "api_keys")
