"""add campaign story fields

Revision ID: c1b9c2d4e6f0
Revises: b1a2d3e4f5a6
Create Date: 2026-03-19 14:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1b9c2d4e6f0"
down_revision: Union[str, Sequence[str], None] = "b1a2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("story_draft", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("story_final", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("campaigns", "story_final")
    op.drop_column("campaigns", "story_draft")

