"""Plan de Acción público, sin credenciales (D38).

CAPA: API
TARJETA: [E-01/HU-01] Acceso como visitante sin credenciales (parte backend).

Único endpoint: `GET /api/v1/publico/plan-accion/actual`. NO exige token: es el
único router de la API sin `exigir_roles`/`UsuarioActualDep`, a propósito, y
por eso va en un archivo aparte del protegido (`router.py`), que no se toca.

Qué se publica y qué no (decisión del PO, D38):
- DTO propio e independiente de `FilaPlanAccionRespuesta`: un campo nuevo en
  el DTO protegido NO se publica por accidente. La prueba
  `test_router_publico_plan_accion.py` fija la lista blanca de claves.
- En `desglose` se publican los montos por rubro y los NÚMEROS de contrato,
  pero no `objeto`, `valor` ni `valor_pagado` de los contratos.
- Sin filtros, sin exportar, sin comparar, sin matriz, sin historial: los
  parámetros de consulta se ignoran (no llegan a ninguna consulta SQL).
- Mismo corte, mismos 404 (sin corte registrado) y 409 (fuentes incompletas)
  que `/plan-accion/actual`.

El límite de peticiones lo aplica `core/limite_peticiones.py` sobre el
prefijo; este router no sabe de él.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.dependencias import ServicioCortesDep, SesionDep
from app.modules.plan_accion.api.router import _obtener_filas_filtradas
from app.modules.plan_accion.domain.entidades import FilaPlanAccion, FiltrosPlanAccion

router = APIRouter(prefix="/publico/plan-accion", tags=["Plan de Accion (publico)"])


class ContratoDesglosePublicoRespuesta(BaseModel):
    numero_contrato: str


class RubroDesglosePublicoRespuesta(BaseModel):
    codigo_rubro: str
    presupuesto_definitivo: Decimal | None
    ejecucion: Decimal | None
    contratos: list[ContratoDesglosePublicoRespuesta]


class FilaPlanAccionPublicaRespuesta(BaseModel):
    sector: str | None
    cod_indicador_producto: str
    nombre_producto: str | None
    meta_programada: Decimal | None
    cod_bpin: str | None
    rubros: list[str]
    presupuesto_definitivo: Decimal | None
    ejecucion: Decimal | None
    contratos: list[str]
    avance_fisico_pct: None
    avance_financiero_pct: Decimal | None
    estado_cruce: str
    bpins: list[str]
    desglose: list[RubroDesglosePublicoRespuesta]


class ResumenPlanAccionPublicoRespuesta(BaseModel):
    total: int
    completo: int
    parcial: int
    sin_informacion: int


class PlanAccionPublicoRespuesta(BaseModel):
    corte_id: UUID
    vigencia: int
    fecha_corte: str
    filas: list[FilaPlanAccionPublicaRespuesta]
    resumen: ResumenPlanAccionPublicoRespuesta


def _fila_a_publica(fila: FilaPlanAccion) -> FilaPlanAccionPublicaRespuesta:
    """Se arma campo por campo desde la entidad de dominio, nunca copiando el
    DTO protegido: lo que no se nombra aquí no sale."""
    return FilaPlanAccionPublicaRespuesta(
        sector=fila.sector,
        cod_indicador_producto=fila.cod_indicador_producto,
        nombre_producto=fila.nombre_producto,
        meta_programada=fila.meta_programada,
        cod_bpin=fila.cod_bpin,
        rubros=list(fila.rubros),
        presupuesto_definitivo=fila.presupuesto_definitivo,
        ejecucion=fila.ejecucion,
        contratos=list(fila.contratos),
        avance_fisico_pct=None,
        avance_financiero_pct=fila.avance_financiero_pct,
        estado_cruce=fila.estado_cruce.value,
        bpins=list(fila.bpins),
        desglose=[
            RubroDesglosePublicoRespuesta(
                codigo_rubro=rubro.codigo_rubro,
                presupuesto_definitivo=rubro.presupuesto_definitivo,
                ejecucion=rubro.ejecucion,
                contratos=[
                    ContratoDesglosePublicoRespuesta(numero_contrato=c.numero_contrato)
                    for c in rubro.contratos
                ],
            )
            for rubro in fila.desglose
        ],
    )


@router.get(
    "/actual",
    response_model=PlanAccionPublicoRespuesta,
    summary="Plan de Acción del corte registrado más reciente (público, sin token)",
    responses={
        404: {"description": "No hay ningún corte registrado."},
        409: {"description": "Al corte más reciente le falta alguna fuente."},
        429: {"description": "Se superó el límite de peticiones por cliente."},
    },
)
def obtener_plan_accion_publico(
    servicio: ServicioCortesDep,
    sesion: SesionDep,
) -> PlanAccionPublicoRespuesta:
    """Mismo corte y mismos 404/409 que `/plan-accion/actual`, sin
    autenticación y con las columnas conservadoras de D38."""
    corte, filas, resumen = _obtener_filas_filtradas(servicio, sesion, FiltrosPlanAccion())
    return PlanAccionPublicoRespuesta(
        corte_id=corte.id,
        vigencia=corte.vigencia,
        fecha_corte=corte.fecha_corte.isoformat(),
        filas=[_fila_a_publica(f) for f in filas],
        resumen=ResumenPlanAccionPublicoRespuesta(
            total=resumen.total,
            completo=resumen.completo,
            parcial=resumen.parcial,
            sin_informacion=resumen.sin_informacion,
        ),
    )
