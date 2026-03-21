"""add world visual_assets (IA mapas/emblemas/retratos)

Revision ID: a7e8f9b0c1d2
Revises: f9b4c2d7a1e3
Create Date: 2026-03-16

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a7e8f9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "f9b4c2d7a1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("worlds", sa.Column("visual_assets", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("worlds", "visual_assets")
