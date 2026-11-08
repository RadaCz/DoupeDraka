"""Create migration.

Revision ID: {{revision}}
Revises: {{down_revision}}
Create Date: {{create_date}}

"""
from alembic import op
import sqlalchemy as sa
{% for import_line in imports -%}
{{ import_line }}
{% endfor -%}

# revision identifiers, used by Alembic.
revision = {{repr(revision)}}
down_revision = {{repr(down_revision)}}
branch_labels = {{repr(branch_labels)}}
depends_on = {{repr(depends_on)}}


def upgrade() -> None:
    {{upgradable}}


def downgrade() -> None:
    {{downgradable}}
