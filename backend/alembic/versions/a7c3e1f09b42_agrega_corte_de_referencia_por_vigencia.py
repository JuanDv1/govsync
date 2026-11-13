"""agrega corte de referencia por vigencia (E02-HU08, CA04)

Revision ID: a7c3e1f09b42
Revises: 5e231b94049b
Create Date: 2026-11-12 00:00:00.000000

Columna `corte.es_referencia` (NOT NULL, false por defecto: los cortes que
ya existen quedan sin marca) e índice único parcial por vigencia: a lo sumo
un corte de referencia por vigencia. Mismo patrón que
`ux_corte_borrador_unico` (3cba947a3f5d).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c3e1f09b42'
down_revision: Union[str, None] = '5e231b94049b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'corte',
        sa.Column('es_referencia', sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index(
        'ux_corte_referencia_por_vigencia',
        'corte',
        ['vigencia'],
        unique=True,
        postgresql_where=sa.text('es_referencia'),
        sqlite_where=sa.text('es_referencia'),
    )


def downgrade() -> None:
    op.drop_index(
        'ux_corte_referencia_por_vigencia',
        table_name='corte',
        postgresql_where=sa.text('es_referencia'),
        sqlite_where=sa.text('es_referencia'),
    )
    op.drop_column('corte', 'es_referencia')
