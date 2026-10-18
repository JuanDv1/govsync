"""Comparación del Plan de Acción entre dos cortes de una misma vigencia.

CAPA: Dominio -- igual criterio que `entidades.py`: sin imports de
FastAPI/SQLAlchemy, verificado por `tests/test_arquitectura.py`.
TARJETA: [E04-HU04] Comparar dos cortes de una misma vigencia
CUBRE: HU04-CA04 (tabla comparativa), CA05 (cálculo de Δ), CA06 (metas
presentes en un solo corte), CA07 (ver solo cambios).

QUÉ NO CUBRE este archivo: CA01/CA02 (listar cortes de la vigencia, avisar
si hay menos de 2) y CA03 (validar vigencia/corte duplicado y ORDENAR cuál
es "Corte A" -- el anterior por `fecha_corte` -- y cuál "Corte B") son
responsabilidad del router (`api/router.py`): son reglas sobre CUÁLES
cortes se comparan, no sobre CÓMO se comparan sus filas ya agregadas. Esta
función recibe las dos listas YA en el orden correcto (A = más antiguo,
B = más reciente) y no sabe nada de `Corte` ni de fechas.

POR QUÉ EL EMPAREJAMIENTO ES POR `cod_indicador_producto`: es la misma
llave que usa `agregar_por_meta` (D26) para identificar una meta de forma
única dentro de un corte -- compararla entre dos cortes requiere la misma
llave, no una nueva.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum

from app.modules.plan_accion.domain.entidades import FilaPlanAccion


class PresenciaMeta(StrEnum):
    """HU04-CA06: si la meta existe en ambos cortes o solo en uno."""

    AMBOS = "ambos"
    SOLO_CORTE_A = "solo_corte_a"
    SOLO_CORTE_B = "solo_corte_b"


@dataclass(frozen=True, slots=True)
class FilaComparacion:
    """Una meta comparada entre Corte A (anterior) y Corte B (posterior).

    Los campos `avance_fisico_pct_*`/`avance_fisico_delta` son SIEMPRE
    `None` -- mismo motivo que `FilaPlanAccion.avance_fisico_pct`: E-03 no
    tiene ningún código todavía. Se mantienen como campos explícitos (no se
    omiten) para que CA04 pueda listar la columna, aunque vacía, igual que
    ya hace HU-01/02/03.
    """

    cod_indicador_producto: str
    nombre_producto: str | None
    sector: str | None
    presencia: PresenciaMeta
    avance_fisico_pct_a: None
    avance_fisico_pct_b: None
    avance_fisico_delta: None
    ejecucion_a: Decimal | None
    ejecucion_b: Decimal | None
    ejecucion_delta: Decimal | None
    avance_financiero_pct_a: Decimal | None
    avance_financiero_pct_b: Decimal | None
    avance_financiero_delta: Decimal | None


def _delta(valor_a: Decimal | None, valor_b: Decimal | None) -> Decimal | None:
    """CA05: "Δ = Corte B − Corte A". `None` si falta cualquiera de los dos
    -- una meta "Solo en Corte A/B" (CA06) no tiene Δ, no tiene Δ=0 (son
    casos distintos: 0 significa "no cambió", None significa "no se puede
    comparar")."""
    if valor_a is None or valor_b is None:
        return None
    return valor_b - valor_a


def comparar_cortes(
    filas_a: list[FilaPlanAccion], filas_b: list[FilaPlanAccion]
) -> list[FilaComparacion]:
    """HU04-CA04/CA05/CA06. `filas_a`/`filas_b` ya vienen agregadas por meta
    (`agregar_por_meta`) -- esta función no agrega ni filtra, solo
    empareja y calcula deltas."""
    por_codigo_a = {f.cod_indicador_producto: f for f in filas_a}
    por_codigo_b = {f.cod_indicador_producto: f for f in filas_b}
    codigos = sorted(set(por_codigo_a) | set(por_codigo_b))

    resultado: list[FilaComparacion] = []
    for codigo in codigos:
        fila_a = por_codigo_a.get(codigo)
        fila_b = por_codigo_b.get(codigo)

        if fila_a is not None and fila_b is not None:
            presencia = PresenciaMeta.AMBOS
        elif fila_a is not None:
            presencia = PresenciaMeta.SOLO_CORTE_A
        else:
            presencia = PresenciaMeta.SOLO_CORTE_B

        referencia = fila_a if fila_a is not None else fila_b
        ejecucion_a = fila_a.ejecucion if fila_a is not None else None
        ejecucion_b = fila_b.ejecucion if fila_b is not None else None
        avance_fin_a = fila_a.avance_financiero_pct if fila_a is not None else None
        avance_fin_b = fila_b.avance_financiero_pct if fila_b is not None else None

        resultado.append(
            FilaComparacion(
                cod_indicador_producto=codigo,
                nombre_producto=referencia.nombre_producto,
                sector=referencia.sector,
                presencia=presencia,
                avance_fisico_pct_a=None,
                avance_fisico_pct_b=None,
                avance_fisico_delta=None,
                ejecucion_a=ejecucion_a,
                ejecucion_b=ejecucion_b,
                ejecucion_delta=_delta(ejecucion_a, ejecucion_b),
                avance_financiero_pct_a=avance_fin_a,
                avance_financiero_pct_b=avance_fin_b,
                avance_financiero_delta=_delta(avance_fin_a, avance_fin_b),
            )
        )

    return resultado


def filtrar_solo_cambios(filas: list[FilaComparacion]) -> list[FilaComparacion]:
    """HU04-CA07: "se ocultan las metas con Δ = 0 en todas las columnas".

    DECISIÓN TÉCNICA (no de negocio): se implementa como filtro de backend
    (no un toggle 100% frontend) por el mismo motivo que los filtros de
    HU-02 -- el volumen (~144 metas/corte) hace que sea tan barato filtrar
    aquí como en el frontend, y mantiene toda la regla de "qué es un
    cambio" en un solo lugar.

    Una meta "Solo en Corte A/B" (CA06) SIEMPRE cuenta como cambio (su Δ es
    `None`, no `0` -- aparecer o desaparecer de un corte a otro es, por
    definición, un cambio) y nunca se oculta aquí.
    """

    def _tiene_cambio(fila: FilaComparacion) -> bool:
        if fila.presencia is not PresenciaMeta.AMBOS:
            return True
        return bool(
            (fila.ejecucion_delta is not None and fila.ejecucion_delta != 0)
            or (fila.avance_financiero_delta is not None and fila.avance_financiero_delta != 0)
        )

    return [fila for fila in filas if _tiene_cambio(fila)]
