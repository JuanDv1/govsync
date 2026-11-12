"""Metas en riesgo por bajo avance financiero.

CAPA: Dominio
TARJETA: [E04-HU07] Visualizar metas con menos del 50 % de avance financiero
CUBRE: HU07-CA01 a CA05, CA07.

Reutiliza el % de avance financiero que ya calcula `agregar_por_meta`
(Ejecución / Presupuesto definitivo × 100). No define qué es "Ejecución":
si la decisión #8 la cambia, se cambia en un solo lugar (la consulta de
`persistence/consultas.py`) y esta regla no se toca.

Decisión del PO (2026-11-11, pendiente de ratificar con la clienta junto
con la decisión #8): una meta con presupuesto definitivo > 0 pero sin
ningún dato de ejecución (`avance_financiero_pct is None`) NO se excluye
de la lista de riesgo. Cuenta como 0 % y se marca
`sin_ejecucion_registrada=True`: el rubro existe y su celda de ejecución
está vacía, es decir, no se ha ejecutado nada -- justamente el caso más
riesgoso, que hoy desaparecía del reporte sin aviso. Es además el mismo
criterio que `_sumar_opcional` ya aplica dentro de una meta: si tiene dos
rubros y uno trae dato, el vacío del otro ya cuenta como 0 ahí.

Una meta con ejecución 0 REAL (algún rubro trajo el valor 0, no vacío)
también entra en 0 %, pero NO se marca: `avance_financiero_pct` ya no es
`None` en ese caso (ver `agregar_por_meta`), así que el código de abajo
distingue los dos casos sin lógica aparte.

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
class MetaEnRiesgo:
    """Una fila de la lista de riesgo, con el % ya resuelto a un valor
    concreto (nunca `None`) y la marca de si ese valor es un dato real o
    uno asumido por la decisión del PO."""

    fila: FilaPlanAccion
    avance_financiero_pct: Decimal
    """Igual a `fila.avance_financiero_pct`, salvo cuando ese es `None`:
    ahí vale 0 (ver `sin_ejecucion_registrada` y el docstring del
    módulo)."""
    sin_ejecucion_registrada: bool
    """True si `fila.avance_financiero_pct` es `None`: hay presupuesto
    definitivo > 0 pero ningún rubro de la meta trajo dato de ejecución."""


@dataclass(frozen=True, slots=True)
class MetasEnRiesgo:
    en_riesgo: tuple[MetaEnRiesgo, ...]
    """Ordenadas de menor a mayor % de avance (CA05)."""
    sin_presupuesto: int
    """Metas sin presupuesto definitivo (vacío o 0): no se les calcula el
    % y no entran a la lista (CA04)."""


def metas_en_riesgo(filas: list[FilaPlanAccion]) -> MetasEnRiesgo:
    """Clasifica las metas ya agregadas de un corte.

    Una meta sin presupuesto definitivo no entra nunca (CA04). Entre las
    que sí tienen presupuesto: con dato de ejecución, entra solo si su %
    es estrictamente menor al umbral; sin ningún dato de ejecución,
    entra siempre, en 0 % y marcada (decisión del PO, ver docstring del
    módulo).
    """
    candidatas: list[MetaEnRiesgo] = []
    for fila in filas:
        if not _tiene_presupuesto(fila):
            continue
        if fila.avance_financiero_pct is None:
            candidatas.append(
                MetaEnRiesgo(
                    fila=fila,
                    avance_financiero_pct=Decimal(0),
                    sin_ejecucion_registrada=True,
                )
            )
        elif fila.avance_financiero_pct < UMBRAL_RIESGO_PCT:
            candidatas.append(
                MetaEnRiesgo(
                    fila=fila,
                    avance_financiero_pct=fila.avance_financiero_pct,
                    sin_ejecucion_registrada=False,
                )
            )

    en_riesgo = sorted(
        candidatas,
        # El código desempata para que el orden sea siempre el mismo.
        key=lambda meta: (meta.avance_financiero_pct, meta.fila.cod_indicador_producto),
    )
    sin_presupuesto = sum(1 for fila in filas if not _tiene_presupuesto(fila))
    return MetasEnRiesgo(en_riesgo=tuple(en_riesgo), sin_presupuesto=sin_presupuesto)


def _tiene_presupuesto(fila: FilaPlanAccion) -> bool:
    return fila.presupuesto_definitivo is not None and fila.presupuesto_definitivo > 0
