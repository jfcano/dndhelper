"""owner_settings hf_token; users is_admin

Revision ID: g5h6i7j8k9l0
Revises: f3a4b5c6d7e8
Create Date: 2026-03-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g5h6i7j8k9l0"
down_revision: Union[str, Sequence[str], None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("owner_settings", sa.Column("hf_token", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("owner_settings", "hf_token")
    op.drop_column("users", "is_admin")
