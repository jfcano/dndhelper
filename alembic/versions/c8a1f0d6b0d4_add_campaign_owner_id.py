"""add campaign owner_id

Revision ID: c8a1f0d6b0d4
Revises: d722aa03183c
Create Date: 2026-03-17

"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8a1f0d6b0d4"
down_revision: Union[str, Sequence[str], None] = "d722aa03183c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_DEFAULT_LOCAL_OWNER_UUID = uuid.UUID("bec82f4c-14ae-43aa-8c40-f45d950517f1")


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("campaigns", sa.Column("owner_id", sa.UUID(), nullable=True))
    op.execute(
        sa.text("UPDATE campaigns SET owner_id = :oid WHERE owner_id IS NULL").bindparams(
            sa.bindparam("oid", _DEFAULT_LOCAL_OWNER_UUID, type_=sa.UUID())
        )
    )
    op.alter_column("campaigns", "owner_id", existing_type=sa.UUID(), nullable=False)
    op.create_index(op.f("ix_campaigns_owner_id"), "campaigns", ["owner_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_campaigns_owner_id"), table_name="campaigns")
    op.drop_column("campaigns", "owner_id")

