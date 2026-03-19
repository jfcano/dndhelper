"""expand world text fields

Revision ID: 9f3c2c1a4d5e
Revises: c36d7f19947f
Create Date: 2026-03-19 10:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f3c2c1a4d5e"
down_revision: Union[str, Sequence[str], None] = "c36d7f19947f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "worlds",
        "name",
        existing_type=sa.String(length=200),
        type_=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "worlds",
        "tone",
        existing_type=sa.String(length=120),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "worlds",
        "tone",
        existing_type=sa.Text(),
        type_=sa.String(length=120),
        existing_nullable=True,
    )
    op.alter_column(
        "worlds",
        "name",
        existing_type=sa.Text(),
        type_=sa.String(length=200),
        existing_nullable=False,
    )
