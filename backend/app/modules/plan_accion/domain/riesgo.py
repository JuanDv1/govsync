"""Metas en riesgo por bajo avance financiero.

CAPA: Dominio
TARJETA: [E04-HU07] Visualizar metas con menos del 50 % de avance financiero
CUBRE: HU07-CA01 a CA05, CA07.

Reutiliza el % de avance financiero que ya calcula `agregar_por_meta`
(Ejecución / Presupuesto definitivo × 100). No define qué es "Ejecución":
si la decisión #8 la cambia, se cambia en un solo lugar (la consulta de
`persistence/consultas.py`) y esta regla no se toca.

PENDIENTE, no implementado: "Responsable" (HU07-CA06, decisión #14: no
está definido de qué fuente sale).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.modules.plan_accion.domain.entidades import FilaPlanAccion

#: HU07-CA01/CA03: riesgo = avance ESTRICTAMENTE menor a este porcentaje.
UMBRAL_RIESGO_PCT = Decimal(50)


@dataclass(frozen=True, slots=True)
class MetasEnRiesgo:
    en_riesgo: tuple[FilaPlanAccion, ...]
    """Ordenadas de menor a mayor % de avance (CA05)."""
    sin_presupuesto: int
    """Metas sin presupuesto definitivo (vacío o 0): no se les calcula el
    % y no entran a la lista (CA04)."""


def metas_en_riesgo(filas: list[FilaPlanAccion]) -> MetasEnRiesgo:
    """Clasifica las metas ya agregadas de un corte.

    Una meta con presupuesto pero sin dato de ejecución tampoco tiene %
    calculable: no entra a la lista ni cuenta como "sin presupuesto".
    """
    en_riesgo = sorted(
        (
            fila
            for fila in filas
            if fila.avance_financiero_pct is not None
            and fila.avance_financiero_pct < UMBRAL_RIESGO_PCT
        ),
        # El código desempata para que el orden sea siempre el mismo.
        key=lambda fila: (fila.avance_financiero_pct, fila.cod_indicador_producto),
    )
    sin_presupuesto = sum(1 for fila in filas if not _tiene_presupuesto(fila))
    return MetasEnRiesgo(en_riesgo=tuple(en_riesgo), sin_presupuesto=sin_presupuesto)


def _tiene_presupuesto(fila: FilaPlanAccion) -> bool:
    return fila.presupuesto_definitivo is not None and fila.presupuesto_definitivo > 0
