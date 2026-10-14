"""Endpoints del Plan de Acción Consolidado.

CAPA: API
TARJETAS: [E04-HU01] Consultar Plan de Acción Consolidado, [E04-HU02]
Filtrar el Plan de Acción, [E04-HU03] Exportar el Plan de Acción a Excel.
CUBRE: HU01-CA01 a CA06, CA08 a CA10 (ver docs/DECISIONES.md D26 para CA02,
CA03, CA05, CA08 -- implementados con defaults propuestos, pendientes de
ratificar). CA07 de HU-01 es 100% frontend (scroll horizontal + columnas
fijas) -- no tiene contraparte aquí.

[E04-HU03] `GET /exportar` reutiliza EXACTAMENTE el mismo pipeline que
`GET /actual` (mismos filtros, misma agregación) -- la única diferencia es
el formato de salida. Para no duplicar las ~20 líneas de "obtener corte ->
validar -> consultar -> agregar -> filtrar" entre los dos endpoints, esa
secuencia se extrajo a `_obtener_filas_filtradas` (ver más abajo); cada
endpoint solo decide qué hacer con el resultado (JSON vs .xlsx). CA07 de
HU-03 (botón "Exportar" deshabilitado sin resultados) es 100% frontend.
CA08 de HU-03 (mensaje genérico si falla la generación) no tiene código
propio: ya lo cubre el manejador global de excepciones
(`app/core/errores.py`), ver docstring de
`persistence/exportacion_excel.py`.

ALCANCE Y PATRÓN: igual que `trazabilidad/api/router.py` -- sin capa de
`application/` propia. El único "caso de uso" es "leer y agregar", sin
escritura, sin transacción, sin orquestación entre repositorios: toda la
lógica no trivial (agregar filas por meta) ya es una función pura de
dominio (`agregar_por_meta`), así que el router solo compone: obtiene el
corte -> valida -> consulta -> agrega -> arma el DTO. Agregar una capa de
aplicación aquí envolvería esas 4 llamadas en una clase sin estado y sin
ninguna regla propia -- indirección sin beneficio (mismo razonamiento ya
documentado para `trazabilidad`, que esta HU reutiliza sin reabrirlo).

[E04-HU02] agrega 4 query params de filtro (sector, estado_cruce,
busqueda, cod_indicador_producto -- este último agregado tras corrección
de D27, docs/DECISIONES.md: "Indicador" es un filtro EXACTO propio, no
redundante con `busqueda` -- ver `FiltrosPlanAccion` en
domain/entidades.py para el porqué de filtrar en Python sobre la lista ya
agregada, no en la consulta SQL).
El orden pasa a ser: obtener_corte -> validar -> consultar -> agregar ->
FILTRAR -> calcular_resumen (CA06: el resumen debe reflejar las filas YA
filtradas) -> armar DTO.

=============================================================================
CA10 -- RESTRICCIÓN DE ROL (DECISIÓN TÉCNICA D26, PENDIENTE DE RATIFICAR)
=============================================================================
CA10 solo dice explícitamente que un "Usuario con rol Supervisor" NO debe
tener acceso. La historia nombra como actores únicamente "administradora y
alcalde" -- ninguno de los dos es el `gestor` de D24 (ese rol existe para
operaciones de escritura en `cortes`, no aparece en esta historia). Se
propone `administrador` + `visitante` (sin `gestor`) como el default más
ajustado a lo que la HU describe, DISTINTO del patrón de D24
(administrador+gestor para escritura en `cortes`) porque esta HU es de
software diferente: ES DE LECTURA y sus actores nombrados no incluyen al
rol operativo. Si el equipo decide que "alcalde" no es el rol `visitante`
actual, o que `gestor` también debe poder consultar el Plan de Acción, este
único `exigir_roles(...)` es el que cambia -- sin tocar nada más del
archivo.
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
from app.modules.cortes.domain.entidades import Corte, TipoArchivoFuente
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.modules.plan_accion.domain.entidades import (
    EstadoCruceMeta,
    FilaFuenteMeta,
    FilaPlanAccion,
    FiltrosPlanAccion,
    ResumenPlanAccion,
    agregar_por_meta,
    calcular_resumen,
    filtrar_plan_accion,
)
from app.modules.plan_accion.persistence.consultas import construir_filas_plan_accion
from app.modules.plan_accion.persistence.exportacion_excel import (
    MetadatosExportacion,
    construir_libro_excel,
    construir_nombre_archivo,
)
from app.shared.errors import OperacionNoPermitida

router = APIRouter(prefix="/plan-accion", tags=["Plan de Accion"])

#: CA10 -- ver docstring del módulo. Any de los dos basta (igual semántica
#: que `exigir_roles` en el resto del backend: "al menos uno"). Mismo patrón
#: que `EscrituraDep` en `cortes/api/router.py`: se envuelve en
#: `Annotated[Usuario, Depends(...)]`, nunca se asigna la dependencia "pelada"
#: (FastAPI/Pydantic necesitan el tipo explícito para resolver el esquema).
AccesoPlanAccionDep = Annotated[Usuario, Depends(exigir_roles(Rol.ADMINISTRADOR, Rol.VISITANTE))]


# --- DTOs (Pydantic, nunca la entidad de dominio) ---------------------------


class FilaPlanAccionRespuesta(BaseModel):
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


class ResumenPlanAccionRespuesta(BaseModel):
    """CA05: pie de la tabla."""

    total: int
    completo: int
    parcial: int
    sin_informacion: int


class PlanAccionRespuesta(BaseModel):
    corte_id: UUID
    vigencia: int
    fecha_corte: str
    filas: list[FilaPlanAccionRespuesta]
    resumen: ResumenPlanAccionRespuesta


def _fila_a_respuesta(fila: FilaPlanAccion) -> FilaPlanAccionRespuesta:
    return FilaPlanAccionRespuesta(
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
    )


def _verificar_fuentes_completas(corte: Corte) -> None:
    """409 -- mismo criterio y misma duplicación deliberada que
    `trazabilidad/api/router.py::_verificar_fuentes_completas` (ver su
    docstring): el Plan de Acción tampoco tiene sentido sin las tres
    fuentes cargadas."""
    faltantes: list[TipoArchivoFuente] = corte.archivos_faltantes()
    if faltantes:
        raise OperacionNoPermitida(
            "El corte no tiene todas las fuentes cargadas. "
            f"Falta: {', '.join(tipo.value for tipo in faltantes)}.",
            detalles={
                "motivo": "fuentes_incompletas",
                "archivos_faltantes": [tipo.value for tipo in faltantes],
            },
        )


def _construir_filtros(
    sector: list[str] | None,
    estado_cruce: list[EstadoCruceMeta] | None,
    busqueda: str | None,
    cod_indicador_producto: list[str] | None,
) -> FiltrosPlanAccion:
    """Traduce los 4 query params crudos (listas vacías/None de FastAPI) al
    value object de dominio -- extraído para que `/actual` y `/exportar`
    (HU-03) no dupliquen esta conversión."""
    return FiltrosPlanAccion(
        sector=tuple(sector) if sector else None,
        estado_cruce=tuple(estado_cruce) if estado_cruce else None,
        busqueda=busqueda,
        cod_indicador_producto=tuple(cod_indicador_producto) if cod_indicador_producto else None,
    )


def _describir_filtros(filtros: FiltrosPlanAccion) -> str:
    """[E04-HU03] CA04: texto legible de los filtros activos para los
    metadatos del Excel exportado. "Ninguno" si no hay ningún filtro --
    mismo caso que CA08 de HU-02 (limpiar filtros)."""
    partes: list[str] = []
    if filtros.sector:
        partes.append(f"Sector: {', '.join(filtros.sector)}")
    if filtros.estado_cruce:
        partes.append(f"Estado de cruce: {', '.join(e.value for e in filtros.estado_cruce)}")
    if filtros.cod_indicador_producto:
        partes.append(f"Indicador: {', '.join(filtros.cod_indicador_producto)}")
    if filtros.busqueda:
        partes.append(f'Búsqueda: "{filtros.busqueda}"')
    return "; ".join(partes) if partes else "Ninguno"


def _obtener_filas_filtradas(
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    filtros: FiltrosPlanAccion,
) -> tuple[Corte, list[FilaPlanAccion], ResumenPlanAccion]:
    """Pipeline compartido por `/actual` (HU-01/HU-02) y `/exportar`
    (HU-03): obtener_corte -> validar -> consultar -> agregar -> filtrar ->
    calcular_resumen. Extraído para no duplicarlo entre los dos endpoints
    (ver docstring del módulo)."""
    corte: Corte = servicio.obtener_corte_actual()
    _verificar_fuentes_completas(corte)

    filas_crudas = construir_filas_plan_accion(sesion, corte.id)
    filas_meta = [
        FilaFuenteMeta(
            cod_indicador_producto=f.cod_indicador_producto,
            nombre_producto=f.nombre_producto,
            sector=f.sector,
            meta_cuatrienio=f.meta_cuatrienio,
            cod_bpin=f.cod_bpin,
            codigo_rubro=f.codigo_rubro,
            presupuesto_apropiado=f.presupuesto_apropiado,
            ejecucion=f.ejecucion,
            numero_contrato=f.numero_contrato,
        )
        for f in filas_crudas
    ]
    filas_agregadas = agregar_por_meta(filas_meta)
    filas_filtradas = filtrar_plan_accion(filas_agregadas, filtros)
    resumen = calcular_resumen(filas_filtradas)
    return corte, filas_filtradas, resumen


@router.get("/actual", response_model=PlanAccionRespuesta)
def obtener_plan_accion_actual(
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    usuario: AccesoPlanAccionDep,
    sector: list[str] | None = Query(None),
    estado_cruce: list[EstadoCruceMeta] | None = Query(None),
    busqueda: str | None = None,
    cod_indicador_producto: list[str] | None = Query(None),
) -> PlanAccionRespuesta:
    """HU01-CA01: Plan de Acción consolidado del corte REGISTRADO más
    reciente (mismo criterio que `trazabilidad`/`ServicioCortes.
    obtener_corte_actual` -- global, sin filtro de vigencia).

    CA09: si no hay ningún corte registrado, `obtener_corte_actual()` ya
    lanza `RecursoNoEncontrado` (404) -- el frontend traduce ese 404 al
    estado vacío "Aún no hay cortes finalizados para consultar" (no es
    responsabilidad de este endpoint decidir el texto, solo señalar que no
    hay datos).

    CA04 (solo lectura): no existe ningún verbo de escritura en este
    router -- la ausencia es la implementación.

    [E04-HU02] `sector`/`estado_cruce`/`cod_indicador_producto` (listas,
    repetibles -- `?sector=a&sector=b`, CA05: OR dentro del criterio) y
    `busqueda` (CA04, texto libre sobre código o nombre de la meta) se
    combinan con AND entre sí (CA05) -- ver
    `FiltrosPlanAccion`/`filtrar_plan_accion` en domain/entidades.py.
    `cod_indicador_producto` es el filtro EXACTO de "Indicador" (D27,
    corrección), mismo nombre de query param que
    `trazabilidad/api/router.py` usa para el filtro equivalente de HU-10.
    CA08 (limpiar filtros): omitir los 4 query params devuelve el Plan de
    Acción completo, sin rama especial.
    """
    filtros = _construir_filtros(sector, estado_cruce, busqueda, cod_indicador_producto)
    corte, filas_filtradas, resumen = _obtener_filas_filtradas(servicio, sesion, filtros)

    return PlanAccionRespuesta(
        corte_id=corte.id,
        vigencia=corte.vigencia,
        fecha_corte=corte.fecha_corte.isoformat(),
        filas=[_fila_a_respuesta(f) for f in filas_filtradas],
        resumen=ResumenPlanAccionRespuesta(
            total=resumen.total,
            completo=resumen.completo,
            parcial=resumen.parcial,
            sin_informacion=resumen.sin_informacion,
        ),
    )


_MEDIA_TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/exportar")
def exportar_plan_accion(
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    usuario: AccesoPlanAccionDep,
    sector: list[str] | None = Query(None),
    estado_cruce: list[EstadoCruceMeta] | None = Query(None),
    busqueda: str | None = None,
    cod_indicador_producto: list[str] | None = Query(None),
) -> Response:
    """[E04-HU03] CA01/CA02: exporta exactamente el mismo resultado que
    `GET /actual` (mismos query params, mismo filtro/agregación -- ver
    `_obtener_filas_filtradas`) como un archivo .xlsx en vez de JSON.

    CA09 (mismo criterio que `/actual`): si no hay corte, `RecursoNoEncontrado`
    (404) -- no tiene sentido ofrecer "exportar" sin datos; CA07 (botón
    deshabilitado) es responsabilidad del frontend, que ya sabe que no hay
    filas por la misma respuesta de `/actual`.
    """
    filtros = _construir_filtros(sector, estado_cruce, busqueda, cod_indicador_producto)
    corte, filas_filtradas, resumen = _obtener_filas_filtradas(servicio, sesion, filtros)

    metadatos = MetadatosExportacion(
        vigencia=corte.vigencia,
        fecha_corte=corte.fecha_corte,
        filtros_aplicados=_describir_filtros(filtros),
        usuario_correo=usuario.correo,
        generado_en=datetime.now(UTC),
    )
    libro = construir_libro_excel(filas_filtradas, resumen, metadatos)

    buffer = BytesIO()
    libro.save(buffer)
    nombre_archivo = construir_nombre_archivo(corte.vigencia, corte.fecha_corte)

    return Response(
        content=buffer.getvalue(),
        media_type=_MEDIA_TYPE_XLSX,
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )
