"""remove `arcs` for MVP.

En el MVP ya no se gestionan entidades `arcs`; las sesiones se relacionan directamente con la campaign.
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f9b4c2d7a1e3"
down_revision: Union[str, Sequence[str], None] = "c1b9c2d4e6f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Eliminamos el FK y la columna antes de borrar la tabla.
    # Esta migración puede ejecutarse sobre BD con estado parcial en entornos de tests,
    # así que protegemos la existencia de tablas/columnas/constraints.
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.sessions') IS NOT NULL THEN
                ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_arc_id_fkey;
                ALTER TABLE sessions DROP COLUMN IF EXISTS arc_id;
            END IF;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.arcs') IS NOT NULL THEN
                DROP TABLE arcs CASCADE;
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    # Reversión aproximada (no se usa en el MVP).
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS arcs (
            id UUID PRIMARY KEY,
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            summary TEXT,
            order_index INTEGER NOT NULL DEFAULT 0,
            approval_status VARCHAR(20) NOT NULL DEFAULT 'draft',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    op.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS arc_id UUID")
    op.execute("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_arc_id_fkey")
    op.execute(
        """
        ALTER TABLE sessions
        ADD CONSTRAINT sessions_arc_id_fkey
        FOREIGN KEY (arc_id) REFERENCES arcs(id) ON DELETE CASCADE;
        """
    )

