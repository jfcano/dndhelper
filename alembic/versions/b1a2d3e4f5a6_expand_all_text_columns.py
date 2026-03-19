"""expand all text columns

Revision ID: b1a2d3e4f5a6
Revises: 9f3c2c1a4d5e
Create Date: 2026-03-19 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1a2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "9f3c2c1a4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "campaigns",
        "name",
        existing_type=sa.String(length=200),
        type_=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "campaigns",
        "tone",
        existing_type=sa.String(length=120),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "arcs",
        "title",
        existing_type=sa.String(length=200),
        type_=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "sessions",
        "title",
        existing_type=sa.String(length=200),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "sessions",
        "title",
        existing_type=sa.Text(),
        type_=sa.String(length=200),
        existing_nullable=False,
    )
    op.alter_column(
        "arcs",
        "title",
        existing_type=sa.Text(),
        type_=sa.String(length=200),
        existing_nullable=False,
    )
    op.alter_column(
        "campaigns",
        "tone",
        existing_type=sa.Text(),
        type_=sa.String(length=120),
        existing_nullable=True,
    )
    op.alter_column(
        "campaigns",
        "name",
        existing_type=sa.Text(),
        type_=sa.String(length=200),
        existing_nullable=False,
    )
