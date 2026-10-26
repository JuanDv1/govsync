"""Endpoints del Plan de Acción Consolidado.

CAPA: API
TARJETAS: [E04-HU01] Consultar Plan de Acción Consolidado, [E04-HU02]
Filtrar el Plan de Acción, [E04-HU03] Exportar el Plan de Acción a Excel,
[E04-HU04] Comparar dos cortes de una misma vigencia.
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

[E04-HU04] agrega dos endpoints nuevos, NO una variante de `/actual`:
`GET /cortes-disponibles` (CA01/CA02: lista los cortes REGISTRADO de una
vigencia para que el frontend arme el selector, o decida deshabilitarlo si
hay menos de 2) y `GET /comparar` (CA03 a CA07: valida el par de cortes,
decide cuál es "Corte A" -- el de `fecha_corte` más antigua -- y cuál
"Corte B", construye las filas agregadas de cada uno por separado
reutilizando `_construir_filas_agregadas`, y delega el emparejamiento y el
cálculo de Δ a `domain/comparacion.py::comparar_cortes`, que NO sabe nada
de `Corte` ni de fechas -- ver su docstring). CA08 (exportar la
comparación) reutiliza `persistence/exportacion_excel.py` de HU-03 -- ver
`_exportar_comparacion` más abajo.

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

from datetime import UTC, date, datetime
from decimal import Decimal
from io import BytesIO
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel

from app.core.dependencias import ServicioCortesDep, SesionDep, exigir_roles
from app.modules.cortes.domain.entidades import Corte, EstadoCorte, TipoArchivoFuente
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.modules.plan_accion.domain.comparacion import (
    FilaComparacion,
    comparar_cortes,
    filtrar_solo_cambios,
)
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
    MetadatosComparacion,
    MetadatosExportacion,
    construir_libro_comparacion,
    construir_libro_excel,
    construir_nombre_archivo,
)
from app.shared.errors import OperacionNoPermitida, ReglaDeNegocioViolada

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


class CorteDisponibleRespuesta(BaseModel):
    """[E04-HU04] CA01/CA02: una opción del selector de "Corte A"/"Corte B"
    en el frontend. Solo se exponen cortes REGISTRADO (ver
    `obtener_cortes_disponibles`) -- comparar contra un BORRADOR no tiene
    sentido (puede seguir cambiando).

    `fecha_corte` es `date` (no `str`): mismo tipo que `CorteRespuesta.
    fecha_corte` en `cortes/api/router.py` -- corrección de la revisión de
    Juan David sobre el PR #154 (2026-10-18), que encontró que estos dos DTO
    nuevos de HU-04 declaraban `str` con `.isoformat()` manual mientras el
    resto del backend deja que Pydantic serialice `date` directamente. El
    valor que viaja por HTTP es idéntico (misma cadena ISO); lo que cambia
    es que el OpenAPI generado ahora describe el campo igual en todo el
    backend. `PlanAccionRespuesta.fecha_corte` (HU-01/03) queda señalado
    para un cambio aparte y no se toca aquí: corregirlo también cambiaría el
    contrato de endpoints que este PR no modifica."""

    id: UUID
    fecha_corte: date


class CorteComparadoRespuesta(BaseModel):
    """[E04-HU04] CA04: metadatos de cada uno de los dos cortes comparados,
    para que el frontend rotule las columnas "A"/"B" con la fecha real.

    `fecha_corte` es `date` -- ver la nota en `CorteDisponibleRespuesta`."""

    corte_id: UUID
    vigencia: int
    fecha_corte: date


class FilaComparacionRespuesta(BaseModel):
    cod_indicador_producto: str
    nombre_producto: str | None
    sector: str | None
    presencia: str
    avance_fisico_pct_a: None
    avance_fisico_pct_b: None
    avance_fisico_delta: None
    ejecucion_a: Decimal | None
    ejecucion_b: Decimal | None
    ejecucion_delta: Decimal | None
    avance_financiero_pct_a: Decimal | None
    avance_financiero_pct_b: Decimal | None
    avance_financiero_delta: Decimal | None


class ComparacionRespuesta(BaseModel):
    corte_a: CorteComparadoRespuesta
    corte_b: CorteComparadoRespuesta
    filas: list[FilaComparacionRespuesta]


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


def _fila_comparacion_a_respuesta(fila: FilaComparacion) -> FilaComparacionRespuesta:
    return FilaComparacionRespuesta(
        cod_indicador_producto=fila.cod_indicador_producto,
        nombre_producto=fila.nombre_producto,
        sector=fila.sector,
        presencia=fila.presencia.value,
        avance_fisico_pct_a=None,
        avance_fisico_pct_b=None,
        avance_fisico_delta=None,
        ejecucion_a=fila.ejecucion_a,
        ejecucion_b=fila.ejecucion_b,
        ejecucion_delta=fila.ejecucion_delta,
        avance_financiero_pct_a=fila.avance_financiero_pct_a,
        avance_financiero_pct_b=fila.avance_financiero_pct_b,
        avance_financiero_delta=fila.avance_financiero_delta,
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


def _construir_filas_agregadas(sesion: SesionDep, corte_id) -> list[FilaPlanAccion]:
    """Consulta + agrega por meta las filas de UN corte dado, sin filtrar.
    Extraído de `_obtener_filas_filtradas` para que [E04-HU04] (`/comparar`,
    que necesita las filas de DOS cortes por separado, antes de cualquier
    filtro) lo reutilice sin repetir el armado de `FilaFuenteMeta`."""
    filas_crudas = construir_filas_plan_accion(sesion, corte_id)
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
    return agregar_por_meta(filas_meta)


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

    filas_agregadas = _construir_filas_agregadas(sesion, corte.id)
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


@router.get(
    "/exportar",
    summary="Exportar el Plan de Acción consolidado (con filtros opcionales) a Excel (.xlsx)",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Sin token válido."},
        status.HTTP_403_FORBIDDEN: {
            "description": "El rol autenticado no tiene acceso al Plan de Acción (CA10)."
        },
        status.HTTP_404_NOT_FOUND: {"description": "Aún no hay ningún corte REGISTRADO (CA09)."},
        status.HTTP_409_CONFLICT: {
            "description": "El corte actual no tiene las tres fuentes cargadas."
        },
        status.HTTP_200_OK: {
            "description": "Archivo .xlsx del Plan de Acción.",
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
        },
    },
)
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


def _validar_y_ordenar_cortes(
    servicio: ServicioCortesDep,
    corte_id_1: UUID,
    corte_id_2: UUID,
) -> tuple[Corte, Corte]:
    """[E04-HU04] CA03: valida el par de cortes y decide cuál es "Corte A"
    (el más antiguo, `fecha_corte` menor) y cuál "Corte B" (el más
    reciente) -- INDEPENDIENTE del orden en que llegaron los query params
    (DECISIÓN TÉCNICA: ordenar en vez de exigir que el frontend siempre
    mande el más antiguo primero, para que un usuario pueda elegir los dos
    cortes del selector en cualquier orden sin que la comparación cambie de
    sentido).

    `servicio.obtener_corte(id)` ya lanza `RecursoNoEncontrado` (404) si
    algún id no existe -- "ambos cortes deben existir" es parte de CA03
    ("elegir dos cortes de la misma vigencia") y no necesita código propio
    aquí.

    CORRECCIÓN (revisión de Juan David sobre el PR #154, 2026-10-18): este
    docstring y el comentario de más abajo citaban "CA07" tanto para esta
    validación de existencia como para el rechazo de un corte en BORRADOR.
    Según `docs/specs/E04-HU04-comparar-cortes.md`, CA07 es "ver solo
    cambios" (`solo_cambios`) -- un criterio distinto, que esta función ni
    siquiera implementa (vive en `filtrar_solo_cambios`,
    `domain/comparacion.py`). Las reglas de existencia/vigencia/BORRADOR
    están bajo "Reglas de negocio" del mismo CA03, no bajo CA07. No cambia
    ningún comportamiento, solo la referencia en los comentarios.
    """
    if corte_id_1 == corte_id_2:
        raise ReglaDeNegocioViolada(
            "No se puede comparar un corte consigo mismo: se requieren dos cortes distintos.",
            detalles={"motivo": "mismo_corte", "corte_id": str(corte_id_1)},
        )

    corte_1 = servicio.obtener_corte(corte_id_1)
    corte_2 = servicio.obtener_corte(corte_id_2)

    # CA03: "misma vigencia" -- comparar PDT de vigencias distintas no tiene
    # sentido semántico (metas, rubros y BPIN cambian de un cuatrienio a
    # otro).
    if corte_1.vigencia != corte_2.vigencia:
        raise ReglaDeNegocioViolada(
            "Solo se pueden comparar cortes de la misma vigencia "
            f"(Corte {corte_1.id}: vigencia {corte_1.vigencia}; "
            f"Corte {corte_2.id}: vigencia {corte_2.vigencia}).",
            detalles={
                "motivo": "vigencias_distintas",
                "vigencia_1": corte_1.vigencia,
                "vigencia_2": corte_2.vigencia,
            },
        )

    # CA03: un corte en BORRADOR puede seguir cambiando -- comparar contra
    # él produciría un resultado que deja de ser válido apenas se registre
    # o se reemplace un archivo. Mismo código HTTP (409) que
    # `_verificar_fuentes_completas` usa para el mismo tipo de situación
    # ("el corte existe, pero todavía no está en condiciones de usarse para
    # esto").
    for corte in (corte_1, corte_2):
        if corte.estado is not EstadoCorte.REGISTRADO:
            raise OperacionNoPermitida(
                f"El corte {corte.id} está en estado {corte.estado.value}; "
                "solo se pueden comparar cortes REGISTRADO.",
                detalles={"motivo": "corte_no_registrado", "corte_id": str(corte.id)},
            )
        _verificar_fuentes_completas(corte)

    if corte_1.fecha_corte <= corte_2.fecha_corte:
        return corte_1, corte_2
    return corte_2, corte_1


def _comparar_y_filtrar(
    sesion: SesionDep,
    corte_a: Corte,
    corte_b: Corte,
    solo_cambios: bool,
) -> list[FilaComparacion]:
    """Arma las filas agregadas de cada corte por separado (CA04: cada
    corte conserva su propio conjunto de metas antes de emparejar) y delega
    el emparejamiento/cálculo de Δ a `domain/comparacion.py`, que no sabe
    nada de `Corte`, `Response` ni query params."""
    filas_a = _construir_filas_agregadas(sesion, corte_a.id)
    filas_b = _construir_filas_agregadas(sesion, corte_b.id)
    filas = comparar_cortes(filas_a, filas_b)
    if solo_cambios:
        filas = filtrar_solo_cambios(filas)
    return filas


#: [E04-HU04] `summary`/`responses` en los 3 endpoints de esta HU: primera
#: vez que se aplica en todo el backend lo que CLAUDE.md pide para "todo
#: endpoint nuevo" (hallazgo de la revisión de Juan David sobre el PR #154,
#: 2026-10-18 -- "ningún router del repo los usa"). Se limita a estos 3
#: endpoints porque son los que trae este PR; extenderlo al resto de
#: `plan_accion`/`cortes`/`trazabilidad`/`ingesta` es una limpieza más
#: grande que el equipo debe decidir aparte, no algo para hacer de paso
#: aquí. No se declara un `model` de error compartido (no existe todavía
#: ninguno en el backend): el cuerpo real de un error lo define
#: `app/core/errores.py` (`{codigo, mensaje, detalles}`), así que estas
#: `responses` documentan el código HTTP y cuándo ocurre, sin inventar un
#: esquema Pydantic de error que nadie más usa.
@router.get(
    "/cortes-disponibles",
    response_model=list[CorteDisponibleRespuesta],
    summary="Listar los cortes REGISTRADO de una vigencia, para el selector de comparación",
    responses={
        status.HTTP_403_FORBIDDEN: {
            "description": "El rol autenticado no tiene acceso al Plan de Acción (CA10)."
        },
    },
)
def obtener_cortes_disponibles(
    servicio: ServicioCortesDep,
    usuario: AccesoPlanAccionDep,
    vigencia: int,
) -> list[CorteDisponibleRespuesta]:
    """[E04-HU04] CA01/CA02: cortes REGISTRADO de una vigencia, para que el
    frontend arme el selector de "Corte A"/"Corte B". CA02 ("si hay menos
    de 2, deshabilitar el selector/botón de comparar") es responsabilidad
    del frontend sobre la longitud de esta lista -- este endpoint no
    rechaza ni distingue el caso de 0 o 1 resultado, solo informa lo que
    hay (mismo criterio que CA08 de HU-02: "sin resultados" no es un error).

    Ordenado por `fecha_corte` ascendente para que el frontend no tenga que
    reordenar el selector.
    """
    cortes = [
        corte
        for corte in servicio.listar_cortes()
        if corte.vigencia == vigencia and corte.estado is EstadoCorte.REGISTRADO
    ]
    cortes.sort(key=lambda corte: corte.fecha_corte)
    return [
        CorteDisponibleRespuesta(id=corte.id, fecha_corte=corte.fecha_corte) for corte in cortes
    ]


@router.get(
    "/comparar",
    response_model=ComparacionRespuesta,
    summary="Comparar el Plan de Acción de dos cortes de la misma vigencia",
    responses={
        status.HTTP_403_FORBIDDEN: {
            "description": "El rol autenticado no tiene acceso al Plan de Acción (CA10)."
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "`corte_id_1` o `corte_id_2` no corresponde a ningún corte existente."
        },
        status.HTTP_409_CONFLICT: {
            "description": "Alguno de los dos cortes está en BORRADOR (CA03) -- "
            "solo se comparan cortes REGISTRADO."
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Los dos ids son el mismo corte, o los cortes son de "
            "vigencias distintas (CA03)."
        },
    },
)
def comparar_plan_accion(
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    usuario: AccesoPlanAccionDep,
    corte_id_1: UUID,
    corte_id_2: UUID,
    solo_cambios: bool = False,
) -> ComparacionRespuesta:
    """[E04-HU04] CA03 a CA07: compara el Plan de Acción de dos cortes de
    la misma vigencia. `corte_id_1`/`corte_id_2` pueden llegar en cualquier
    orden -- `_validar_y_ordenar_cortes` decide cuál es "A" (más antiguo) y
    cuál "B" (más reciente).

    `solo_cambios` (CA07: "ver solo las metas con cambios" -- corregido de
    "CA06" en la revisión de Juan David sobre el PR #154, 2026-10-18: CA06
    es "metas presentes en un solo corte", un criterio distinto; ver
    `docs/specs/E04-HU04-comparar-cortes.md`): filtro de backend, no un
    toggle puramente visual en frontend -- mismo criterio que D27/HU-02
    (filtrar donde ya existe la regla, no duplicarla en dos capas). Las
    metas que solo existen en un corte (`SOLO_CORTE_A`/`SOLO_CORTE_B`,
    CA06) siempre se consideran "con cambios" y nunca se ocultan con este
    filtro -- ver `domain/comparacion.py::filtrar_solo_cambios`.
    """
    corte_a, corte_b = _validar_y_ordenar_cortes(servicio, corte_id_1, corte_id_2)
    filas = _comparar_y_filtrar(sesion, corte_a, corte_b, solo_cambios)

    return ComparacionRespuesta(
        corte_a=CorteComparadoRespuesta(
            corte_id=corte_a.id,
            vigencia=corte_a.vigencia,
            fecha_corte=corte_a.fecha_corte,
        ),
        corte_b=CorteComparadoRespuesta(
            corte_id=corte_b.id,
            vigencia=corte_b.vigencia,
            fecha_corte=corte_b.fecha_corte,
        ),
        filas=[_fila_comparacion_a_respuesta(f) for f in filas],
    )


@router.get(
    "/comparar/exportar",
    summary="Exportar la comparación de dos cortes de la misma vigencia a Excel (.xlsx)",
    responses={
        status.HTTP_403_FORBIDDEN: {
            "description": "El rol autenticado no tiene acceso al Plan de Acción (CA10)."
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "`corte_id_1` o `corte_id_2` no corresponde a ningún corte existente."
        },
        status.HTTP_409_CONFLICT: {
            "description": "Alguno de los dos cortes está en BORRADOR (CA03) -- "
            "solo se comparan cortes REGISTRADO."
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "Los dos ids son el mismo corte, o los cortes son de "
            "vigencias distintas (CA03)."
        },
        status.HTTP_200_OK: {
            "description": "Archivo .xlsx de la comparación.",
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
        },
    },
)
def exportar_comparacion_plan_accion(
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    usuario: AccesoPlanAccionDep,
    corte_id_1: UUID,
    corte_id_2: UUID,
    solo_cambios: bool = False,
) -> Response:
    """[E04-HU04] CA08: exporta exactamente el mismo resultado que
    `GET /comparar` (mismos query params, misma validación/orden -- ver
    `_validar_y_ordenar_cortes`/`_comparar_y_filtrar`) como un archivo
    .xlsx, reutilizando `persistence/exportacion_excel.py` (ver su
    docstring de la sección HU04-CA08: NO reutiliza `construir_libro_excel`
    de HU-03 porque la tabla de comparación tiene columnas distintas)."""
    corte_a, corte_b = _validar_y_ordenar_cortes(servicio, corte_id_1, corte_id_2)
    filas = _comparar_y_filtrar(sesion, corte_a, corte_b, solo_cambios)

    metadatos = MetadatosComparacion(
        vigencia=corte_a.vigencia,
        fecha_corte_a=corte_a.fecha_corte,
        fecha_corte_b=corte_b.fecha_corte,
        usuario_correo=usuario.correo,
        generado_en=datetime.now(UTC),
    )
    libro = construir_libro_comparacion(filas, metadatos)

    buffer = BytesIO()
    libro.save(buffer)
    nombre_archivo = (
        f"Comparacion_Plan_Accion_{corte_a.vigencia}_"
        f"{corte_a.fecha_corte.isoformat()}_vs_{corte_b.fecha_corte.isoformat()}.xlsx"
    )

    return Response(
        content=buffer.getvalue(),
        media_type=_MEDIA_TYPE_XLSX,
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )
