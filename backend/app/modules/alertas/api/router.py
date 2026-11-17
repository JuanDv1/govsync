"""Registros no relacionados del cruce de un corte.

CAPA: API
TARJETA: [E-04/HU-05] BE - Visualizar registros no relacionados (alertas de
cruce). CUBRE: HU05-CA01 a CA07 (CA06 = lista vacía con total 0; el
mensaje lo pone el frontend).

Mismo patrón que `plan_accion/api/router.py` (módulo de solo lectura sin
capa de aplicación propia): obtener el corte con `ServicioCortes` (404),
validar que se pueda consultar (409), consultar en persistencia y dejar al
dominio filtrar, contar y paginar.

ACCESO: la historia es para "administradora y alcalde", es decir
`administrador` y `visitante`. La decisión 8 del refinamiento decía
"cualquier rol autenticado", pero D37 (PO, 2026-11-11, PR #209) dejó al
`gestor` sin módulos en esta versión; se aplica la regla más reciente y la
que nombra la historia. La vista NO es pública (decisión 8).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from io import BytesIO
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel

from app.core.dependencias import ServicioCortesDep, SesionDep, exigir_roles
from app.modules.alertas.domain.registros_no_relacionados import (
    ETIQUETAS_FUENTE,
    ETIQUETAS_MOTIVO,
    TAMANO_PAGINA_MAXIMO,
    FiltrosNoRelacionados,
    Fuente,
    Motivo,
    RegistroNoRelacionado,
    consultar,
)
from app.modules.alertas.persistence.consultas import listar_registros_no_relacionados
from app.modules.alertas.persistence.exportacion_excel import (
    MetadatosExportacionNoRelacionados,
    construir_libro_no_relacionados,
    construir_nombre_archivo,
)
from app.modules.cortes.domain.entidades import Corte, EstadoCorte
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.shared.errors import OperacionNoPermitida

router = APIRouter(prefix="/registros-no-relacionados", tags=["Alertas de cruce"])

AccesoAlertasDep = Annotated[Usuario, Depends(exigir_roles(Rol.ADMINISTRADOR, Rol.VISITANTE))]

_MEDIA_TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_RESPUESTAS_DE_ERROR = {
    404: {"description": "El corte no existe."},
    409: {"description": "El corte está en BORRADOR o le falta alguna fuente."},
}


# --- DTOs -------------------------------------------------------------------


class RegistroNoRelacionadoRespuesta(BaseModel):
    fuente: Fuente
    fuente_etiqueta: str
    codigo: str | None
    descripcion: str | None
    valor: Decimal | None
    """`null` si no aplica (meta y proyecto); nunca 0."""
    motivo: Motivo
    """CA03: catálogo cerrado, visible como enum en el OpenAPI."""
    motivo_etiqueta: str


class RegistrosNoRelacionadosRespuesta(BaseModel):
    corte_id: UUID
    vigencia: int
    fecha_corte: str
    total: int
    """CA05: total de filas que cumplen los filtros (antes de paginar)."""
    conteos_por_fuente: dict[Fuente, int]
    """CA05: siempre las tres fuentes; su suma es `total`."""
    pagina: int
    tamano_pagina: int
    filas: list[RegistroNoRelacionadoRespuesta]


def _a_respuesta(registro: RegistroNoRelacionado) -> RegistroNoRelacionadoRespuesta:
    return RegistroNoRelacionadoRespuesta(
        fuente=registro.fuente,
        fuente_etiqueta=ETIQUETAS_FUENTE[registro.fuente],
        codigo=registro.codigo,
        descripcion=registro.descripcion,
        valor=registro.valor,
        motivo=registro.motivo,
        motivo_etiqueta=ETIQUETAS_MOTIVO[registro.motivo],
    )


# --- Reglas de consulta -----------------------------------------------------


def _verificar_consultable(corte: Corte) -> None:
    """409: un BORRADOR todavía puede cambiar y, sin las tres fuentes, todo
    saldría "no relacionado" por falta de datos, no por inconsistencia."""
    if corte.estado != EstadoCorte.REGISTRADO:
        raise OperacionNoPermitida(
            "El corte todavía está en BORRADOR; los registros no relacionados se "
            "consultan sobre un corte registrado.",
            detalles={"motivo": "corte_no_registrado", "estado_actual": corte.estado.value},
        )
    faltantes = corte.archivos_faltantes()
    if faltantes:
        raise OperacionNoPermitida(
            "El corte no tiene todas las fuentes cargadas. "
            f"Falta: {', '.join(tipo.value for tipo in faltantes)}.",
            detalles={
                "motivo": "fuentes_incompletas",
                "archivos_faltantes": [tipo.value for tipo in faltantes],
            },
        )


def _filtros(fuente: list[Fuente] | None, motivo: list[Motivo] | None) -> FiltrosNoRelacionados:
    return FiltrosNoRelacionados(
        fuentes=tuple(fuente) if fuente else None,
        motivos=tuple(motivo) if motivo else None,
    )


def _describir_filtros(filtros: FiltrosNoRelacionados) -> str:
    partes = []
    if filtros.fuentes:
        partes.append("Fuente: " + ", ".join(ETIQUETAS_FUENTE[f] for f in filtros.fuentes))
    if filtros.motivos:
        partes.append("Motivo: " + ", ".join(ETIQUETAS_MOTIVO[m] for m in filtros.motivos))
    return "; ".join(partes) if partes else "Ninguno"


FuenteQuery = Annotated[
    list[Fuente] | None, Query(description="Repetible: OR dentro del criterio (CA04).")
]
MotivoQuery = Annotated[
    list[Motivo] | None, Query(description="Repetible: OR dentro del criterio (CA04).")
]


# --- Endpoints --------------------------------------------------------------


@router.get(
    "/{corte_id}",
    response_model=RegistrosNoRelacionadosRespuesta,
    summary="Registros no relacionados del cruce de un corte",
    responses=_RESPUESTAS_DE_ERROR,
)
def obtener_registros_no_relacionados(
    corte_id: UUID,
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    usuario: AccesoAlertasDep,
    fuente: FuenteQuery = None,
    motivo: MotivoQuery = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamano_pagina: Annotated[int, Query(ge=1, le=TAMANO_PAGINA_MAXIMO)] = 50,
) -> RegistrosNoRelacionadosRespuesta:
    """HU05-CA01 a CA06. Filtros por fuente y motivo (listas, OR dentro del
    criterio, AND entre criterios), aplicados antes de contar y de paginar."""
    corte = servicio.obtener_corte(corte_id)
    _verificar_consultable(corte)

    resultado = consultar(
        listar_registros_no_relacionados(sesion, corte.id),
        _filtros(fuente, motivo),
        pagina,
        tamano_pagina,
    )
    return RegistrosNoRelacionadosRespuesta(
        corte_id=corte.id,
        vigencia=corte.vigencia,
        fecha_corte=corte.fecha_corte.isoformat(),
        total=resultado.total,
        conteos_por_fuente=resultado.conteos_por_fuente,
        pagina=resultado.pagina,
        tamano_pagina=resultado.tamano_pagina,
        filas=[_a_respuesta(r) for r in resultado.filas],
    )


@router.get(
    "/{corte_id}/exportar",
    summary="Exportar a Excel los registros no relacionados (con filtros)",
    response_class=Response,
    responses={
        200: {"content": {_MEDIA_TYPE_XLSX: {}}, "description": "Archivo .xlsx"},
        **_RESPUESTAS_DE_ERROR,
    },
)
def exportar_registros_no_relacionados(
    corte_id: UUID,
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    usuario: AccesoAlertasDep,
    fuente: FuenteQuery = None,
    motivo: MotivoQuery = None,
) -> Response:
    """HU05-CA07: el mismo resultado que el JSON con los mismos filtros, sin
    paginar (CA05: filas exportadas = `total`)."""
    corte = servicio.obtener_corte(corte_id)
    _verificar_consultable(corte)

    filtros = _filtros(fuente, motivo)
    registros = listar_registros_no_relacionados(sesion, corte.id)
    completo = consultar(registros, filtros, pagina=1, tamano_pagina=max(len(registros), 1))

    libro = construir_libro_no_relacionados(
        list(completo.filas),
        completo.conteos_por_fuente,
        MetadatosExportacionNoRelacionados(
            vigencia=corte.vigencia,
            fecha_corte=corte.fecha_corte,
            filtros_aplicados=_describir_filtros(filtros),
            usuario_correo=usuario.correo,
            generado_en=datetime.now(UTC),
        ),
    )
    buffer = BytesIO()
    libro.save(buffer)
    nombre = construir_nombre_archivo(corte.vigencia, corte.fecha_corte)
    return Response(
        content=buffer.getvalue(),
        media_type=_MEDIA_TYPE_XLSX,
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
