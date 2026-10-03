"""Endpoints de la matriz de relación y sus filtros.

CAPA: API
TARJETA: [HU-07][FE-01] Endpoint de la matriz con paginación
         [HU-10] Filtros de la matriz (BPIN, Indicador, Producto, Contrato,
         Sector, Programa) + endpoint de opciones de filtro (Sprint 2)

Se intentó enviar las columnas junto con los datos (constante `COLUMNAS`,
para que el contrato de las seis columnas confirmadas viviera en un solo
lugar) pero `MatrizRespuesta` nunca llegó a usarla — quedó como código
muerto y se borró el 2026-09-21 (ver docs/TRAZABILIDAD.md, nota
2026-09-19, y la fila HU-07 en la tabla de infraestructura). Confirmado
con Cristhian y Karold: el frontend no depende de recibirlas desde la
API (`MatrizRelacion.jsx` ya las fija localmente). No reintroducir sin
resolver primero cómo se consumiría realmente.

ALCANCE: GET /matriz-relacion/{corte_id} y GET /matriz-relacion/actual
(este último, 2026-09-21, cierra el TODO que dependía de
`ServicioCortes.obtener_corte_actual()` en `casos_uso.py`). El chequeo
de "las tres fuentes cargadas" (409) vive aquí, no en una capa de
aplicación nueva — PLANDETRABAJO.md (5.1-5.4) solo asigna 2 archivos a
HU-07 backend (consultas.py, este router), sin `trazabilidad/application/`.
Es una excepción deliberada al patrón de `cortes/api/router.py` (que sí
delega todo a casos_uso.py): el chequeo reutiliza `Corte.archivos_faltantes()`,
ya existente, no fabrica una regla de negocio nueva. Duplicado a propósito
entre los dos endpoints, sin helper compartido -- ver docstring de cada uno.

HU-10 (Sprint 2) suma, sin tocar ese patrón: seis query params de filtro
(listas -- `Query(None)`, repetible: `?bpin=a&bpin=b`, forma nativa de
FastAPI, sin parseo manual de CSV) en ambos endpoints de matriz, más un
tercer endpoint `GET /matriz-relacion/{corte_id}/opciones-filtro` (CA-1,
CA-3) que expone los valores disponibles por criterio. Mismo criterio de
409/404 que los otros dos -- ver cada docstring.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.dependencias import ServicioCortesDep, SesionDep
from app.modules.cortes.domain.entidades import Corte, TipoArchivoFuente
from app.modules.trazabilidad.persistence.consultas import construir_matriz, obtener_opciones_filtro
from app.shared.errors import OperacionNoPermitida

router = APIRouter(prefix="/matriz-relacion", tags=["Trazabilidad"])


#: Valores válidos de `estado_cruce` (HU-07, filtros de la matriz) — mismos
#: nombres que `consultas.py::_construir_consulta_base` interpreta.
EstadoCruce = Literal["completo", "sin_proyecto", "sin_ejecucion", "sin_contrato", "sin_cruce"]


# --- DTOs (Pydantic, nunca la entidad de dominio/ORM) -----------------------


class FilaMatrizRespuesta(BaseModel):
    cod_indicador_producto: str
    nombre_producto: str | None
    cod_bpin: str | None
    nombre_proyecto: str | None
    cod_indicador_ejecucion: str | None
    numero_contrato: str | None
    descripcion_contrato: str | None
    presupuesto_apropiado: Decimal | None


class MatrizRespuesta(BaseModel):
    corte_id: UUID
    pagina: int
    tamano_pagina: int
    total_filas: int
    filas: list[FilaMatrizRespuesta]


class IndicadorOpcion(BaseModel):
    """HU-10/CA-4: "código – nombre" -- par mostrado en el selector."""

    codigo: str
    nombre: str | None


class OpcionesFiltroRespuesta(BaseModel):
    bpin: list[str]
    indicadores: list[IndicadorOpcion]
    productos: list[str]
    contratos: list[str]
    sectores: list[str]
    programas: list[str]


def _fila_a_respuesta(fila) -> FilaMatrizRespuesta:
    return FilaMatrizRespuesta(
        cod_indicador_producto=fila.cod_indicador_producto,
        nombre_producto=fila.nombre_producto,
        cod_bpin=fila.cod_bpin,
        nombre_proyecto=fila.nombre_proyecto,
        cod_indicador_ejecucion=fila.cod_indicador_ejecucion,
        numero_contrato=fila.numero_contrato,
        descripcion_contrato=fila.descripcion_contrato,
        presupuesto_apropiado=fila.presupuesto_apropiado,
    )


def _verificar_fuentes_completas(corte: Corte) -> None:
    """409 compartido por los tres endpoints -- ver nota del docstring del
    módulo sobre por qué esto se duplica en vez de extraerse a una capa de
    aplicación (decisión ya tomada para HU-07, HU-10 la hereda sin
    reabrirla)."""
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


# --- Endpoints ---------------------------------------------------------------

# IMPORTANTE: /actual debe registrarse ANTES que /{corte_id} -- FastAPI
# resuelve rutas en el orden en que se registran, no por especificidad; si
# quedara después, una petición a /actual intentaría primero matchear
# /{corte_id} con corte_id="actual" y devolvería 422 (no es un UUID válido)
# en vez de llegar nunca a este endpoint. Mismo motivo por el que
# /{corte_id}/opciones-filtro no choca con /actual: formas de ruta distintas.


@router.get("/actual", response_model=MatrizRespuesta)
def obtener_matriz_actual(
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    pagina: int = 1,
    tamano_pagina: int = 50,
    estado_cruce: EstadoCruce | None = None,
    busqueda: str | None = None,
    bpin: list[str] | None = Query(None),
    cod_indicador_producto: list[str] | None = Query(None),
    producto: list[str] | None = Query(None),
    numero_contrato: list[str] | None = Query(None),
    sector: list[str] | None = Query(None),
    programa: list[str] | None = Query(None),
) -> MatrizRespuesta:
    """HU-07/CA-1: matriz de relación del corte REGISTRADO más reciente,
    global (sin filtro de vigencia -- mismo criterio que D11 usa para
    existe_borrador_activo()).

    404 si no hay ningún corte registrado todavía (`RecursoNoEncontrado`,
    `ServicioCortes.obtener_corte_actual`, ya mapeado en
    `app/core/errores.py` -- no se maneja aquí). 409 si al corte más
    reciente le falta alguna fuente -- mismo criterio que `obtener_matriz`
    (`/{corte_id}`), deliberadamente duplicado aquí en vez de extraído a
    un helper compartido, para no tocar ese endpoint ya cerrado.

    `estado_cruce`/`busqueda`: filtros de la matriz (ver
    `consultas.py::construir_matriz`), agregados 2026-09-23.

    HU-10 (Sprint 2): `bpin`/`cod_indicador_producto`/`producto`/
    `numero_contrato`/`sector`/`programa` -- cada uno repetible
    (`?bpin=a&bpin=b`, CA-8: OR dentro del criterio); varios criterios a
    la vez se combinan con AND (CA-9).
    """
    corte: Corte = servicio.obtener_corte_actual()
    _verificar_fuentes_completas(corte)

    resultado = construir_matriz(
        sesion,
        corte.id,
        pagina,
        tamano_pagina,
        estado_cruce=estado_cruce,
        busqueda=busqueda,
        bpin=bpin,
        cod_indicador_producto=cod_indicador_producto,
        producto=producto,
        numero_contrato=numero_contrato,
        sector=sector,
        programa=programa,
    )
    return MatrizRespuesta(
        corte_id=corte.id,
        pagina=resultado.pagina,
        tamano_pagina=resultado.tamano_pagina,
        total_filas=resultado.total,
        filas=[_fila_a_respuesta(fila) for fila in resultado.filas],
    )


@router.get("/{corte_id}/opciones-filtro", response_model=OpcionesFiltroRespuesta)
def obtener_opciones_filtro_endpoint(
    corte_id: UUID,
    servicio: ServicioCortesDep,
    sesion: SesionDep,
) -> OpcionesFiltroRespuesta:
    """HU-10/CA-1, CA-3: valores disponibles para cada criterio de filtro
    del corte -- "las opciones de cada criterio solo incluyen valores que
    existen en el corte mostrado" (CA-1). Mismo 404/409 que
    `obtener_matriz`: sin las tres fuentes cargadas no hay cruce sobre el
    cual calcular opciones.

    CA-3 (autocompletar BPIN/Contrato): no hay un endpoint de autocompletado
    aparte -- ver DECISIÓN TÉCNICA en `consultas.py::obtener_opciones_filtro`.
    El frontend filtra client-side ("contiene", desde 3 caracteres) sobre
    `bpin`/`contratos` ya traídos por este endpoint.
    """
    corte: Corte = servicio.obtener_corte(corte_id)
    _verificar_fuentes_completas(corte)

    opciones = obtener_opciones_filtro(sesion, corte_id)
    return OpcionesFiltroRespuesta(
        bpin=opciones.bpin,
        indicadores=[
            IndicadorOpcion(codigo=codigo, nombre=nombre) for codigo, nombre in opciones.indicadores
        ],
        productos=opciones.productos,
        contratos=opciones.contratos,
        sectores=opciones.sectores,
        programas=opciones.programas,
    )


@router.get("/{corte_id}", response_model=MatrizRespuesta)
def obtener_matriz(
    corte_id: UUID,
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    pagina: int = 1,
    tamano_pagina: int = 50,
    estado_cruce: EstadoCruce | None = None,
    busqueda: str | None = None,
    bpin: list[str] | None = Query(None),
    cod_indicador_producto: list[str] | None = Query(None),
    producto: list[str] | None = Query(None),
    numero_contrato: list[str] | None = Query(None),
    sector: list[str] | None = Query(None),
    programa: list[str] | None = Query(None),
) -> MatrizRespuesta:
    """HU-07/CA-1: matriz de relación de un corte específico.

    404 ya lo lanza `ServicioCortes.obtener_corte` (RecursoNoEncontrado,
    mapeado en core/errores.py) — no se maneja aquí, mismo patrón que
    cortes/api/router.py::obtener_corte.

    409 si falta alguna de las tres fuentes: reutiliza
    `Corte.archivos_faltantes()` (ya existente, HU-01), sin duplicar la
    regla. `detalles.archivos_faltantes` nombra exactamente qué falta.

    `estado_cruce`/`busqueda`: filtros de la matriz (ver
    `consultas.py::construir_matriz`), agregados 2026-09-23.

    HU-10 (Sprint 2): `bpin`/`cod_indicador_producto`/`producto`/
    `numero_contrato`/`sector`/`programa` -- cada uno repetible
    (`?bpin=a&bpin=b`, CA-8: OR dentro del criterio); varios criterios a
    la vez se combinan con AND (CA-9).
    """
    corte: Corte = servicio.obtener_corte(corte_id)
    _verificar_fuentes_completas(corte)

    resultado = construir_matriz(
        sesion,
        corte_id,
        pagina,
        tamano_pagina,
        estado_cruce=estado_cruce,
        busqueda=busqueda,
        bpin=bpin,
        cod_indicador_producto=cod_indicador_producto,
        producto=producto,
        numero_contrato=numero_contrato,
        sector=sector,
        programa=programa,
    )
    return MatrizRespuesta(
        corte_id=corte_id,
        pagina=resultado.pagina,
        tamano_pagina=resultado.tamano_pagina,
        total_filas=resultado.total,
        filas=[_fila_a_respuesta(fila) for fila in resultado.filas],
    )
