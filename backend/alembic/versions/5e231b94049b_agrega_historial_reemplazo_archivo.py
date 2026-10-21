"""agrega tabla historial_reemplazo_archivo (E02-HU05, CA06)

Revision ID: 5e231b94049b
Revises: 122e94509b80
Create Date: 2026-10-13 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '5e231b94049b'
down_revision: Union[str, None] = '122e94509b80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'historial_reemplazo_archivo',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('corte_id', sa.Uuid(), nullable=False),
        sa.Column(
            'tipo',
            postgresql.ENUM(
                'PDT',
                'EJECUCION',
                'PROYECTOS',
                name='tipo_archivo_fuente',
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('nombre_archivo_anterior', sa.String(length=255), nullable=True),
        sa.Column('nombre_archivo_nuevo', sa.String(length=255), nullable=False),
        sa.Column('usuario', sa.String(length=255), nullable=False),
        sa.Column('fecha', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['corte_id'], ['corte.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_historial_reemplazo_archivo_corte_id'),
        'historial_reemplazo_archivo',
        ['corte_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_historial_reemplazo_archivo_corte_id'),
        table_name='historial_reemplazo_archivo',
    )
    op.drop_table('historial_reemplazo_archivo')
