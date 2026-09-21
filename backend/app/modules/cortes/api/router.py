"""Endpoints de cortes y carga de archivos fuente.

CAPA: API
TARJETAS: [HU-01][FE-01] Endpoints de corte
          [HU-02][FE-01] Endpoint de carga del Plan Indicativo
          [HU-03][FE-01] Endpoint de carga del archivo presupuestal
          [HU-04][FE-01] Endpoint de carga de la plantilla BPIN

Solo HTTP: validación superficial, conversión a DTO y códigos de estado.
NINGUNA regla de negocio ni consulta vive aquí.

Los DTO son modelos Pydantic, NUNCA entidades ORM: si se expusiera el ORM,
agregar una columna cambiaría el contrato de la API en silencio.

Al terminar, registrar el router en app/main.py.

=============================================================================
ALCANCE DE [HU-01][FE-01] EN ESTA ITERACIÓN
=============================================================================
Cubre POST /cortes, GET /cortes, GET /cortes/{id} y PATCH /cortes/{id}. NO
cubre:

- POST /cortes/{id}/registrar: `Corte.registrar()` y
  `ServicioCortes.registrar_corte()` ya están implementados y probados
  (`casos_uso.py:245`) — es [HU-01][BE-05] (Juan Esteban); falta únicamente
  exponer el endpoint HTTP aquí, no la lógica de negocio.
- POST /cortes/{id}/archivos/{tipo}: implementado para los 3 tipos
  (PDT/EJECUCION/PROYECTOS, HU-02/03/04 CA-1) — el guard temporal que
  rechazaba EJECUCION/PROYECTOS con 501 se retiró: `[HU-03][BE-06]` y
  `[HU-04][BE-01]` ya cierran en `develop`. El cuerpo de éxito
  (`ArchivoFuenteRespuestaParcial`) ya expone `descartes` con `categoria`
  ([HU-04][FE-03], D14) pero sigue siendo provisional: no cumple todavía
  el contrato completo de `docs/ESPECIFICACIONES_TECNICAS.md` (falta
  `advertencias` y, para PROYECTOS, `proyectos_reconocidos`/
  `indicadores_extraidos` separados — ver docstring del DTO).

PATCH /cortes/{id} (D11, docs/DECISIONES.md, aclaración 2026-09-19): corrige
vigencia/fecha de un corte en BORRADOR. Solo aplica a BORRADOR (un
REGISTRADO se rechaza con 409), es total (exige vigencia y fecha_corte
juntos, mismo contrato que POST /cortes) y es exclusivamente vigencia/fecha
— no toca `archivos` (eso sigue su propio mecanismo de reemplazo por tipo,
HU-06). 409 por "vigencia+fecha duplicada" reutiliza
`existe_corte_duplicado` (domain/puertos.py, ya consumida por `crear_corte`)
excluyendo al propio corte que se corrige.

El DTO de salida (`CorteRespuesta`) NO expone `archivos_faltantes`: el
array `archivos` solo lista lo ya cargado/reutilizado, tal como está
especificado en docs/ESPECIFICACIONES_TECNICAS.md. Es derivable en el
cliente contra el conjunto fijo {PDT, EJECUCION, PROYECTOS}; el consumidor
real de "qué falta" es el 422 de [HU-01][BE-05] al registrar, no la
respuesta exitosa de GET/POST /cortes.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException

from app.core.config import Settings, get_settings
from app.core.dependencias import ServicioCortesDep
from app.modules.cortes.domain.entidades import Corte, TipoArchivoFuente
from app.shared.codigos import CategoriaDescarte
from app.shared.errors import ArchivoInvalido

router = APIRouter(prefix="/cortes", tags=["Cortes de seguimiento"])


# --- DTOs (Pydantic, nunca la entidad de dominio/ORM) -----------------------


class CorteEntrada(BaseModel):
    vigencia: int
    fecha_corte: date


class CorteCorreccion(BaseModel):
    """D11: cuerpo de PATCH /cortes/{id}.

    Misma forma que `CorteEntrada` hoy, pero clase propia a propósito:
    corregir y crear son operaciones semánticamente distintas aunque
    compartan validación — el nombre debe reflejarlo en el schema de
    OpenAPI, y separarlas evita tener que elegir entre romper POST /cortes
    o duplicar la clase bajo presión si D11 evoluciona a un PATCH parcial
    más adelante.
    """

    vigencia: int
    fecha_corte: date


class ArchivoFuenteRespuesta(BaseModel):
    tipo: str
    reutilizado: bool
    corte_origen_id: UUID | None


class CorteRespuesta(BaseModel):
    id: UUID
    vigencia: int
    fecha_corte: date
    estado: str
    archivos: list[ArchivoFuenteRespuesta]


class DescarteRespuesta(BaseModel):
    """D14 (docs/DECISIONES.md): un fragmento de indicador descartado, con
    `categoria` para que la vista previa de [HU-04][FE-03] priorice
    descartes reales (POSIBLE_CERO_PERDIDO/LONGITUD_LARGA) sobre ruido de
    texto libre (LONGITUD_CORTA) — ver docstring de `CategoriaDescarte`
    en `shared/codigos.py`.
    """

    valor_crudo: str
    motivo: str
    categoria: CategoriaDescarte


class ArchivoFuenteRespuestaParcial(BaseModel):
    """Forma PROVISIONAL de la respuesta de POST /cortes/{id}/archivos/{tipo}.

    `descartes` y `codigos` ya cierran las dos mitades de [HU-04][FE-03]
    ("vista previa de códigos extraídos y descartados"): `descartes`
    desde PR #77 (D14), `codigos` desde PR #87 (D16, deduplicado por
    `.valor` en orden de primera aparición) — `[]` para PDT/EJECUCION
    (no producen códigos de indicador) y para archivos reutilizados,
    comportamiento correcto, no una limitación.

    Sigue sin ser el contrato completo de docs/ESPECIFICACIONES_TECNICAS.md:
    para PROYECTOS esa especificación también pide `proyectos_reconocidos`/
    `indicadores_extraidos` separados — `filas_reconocidas` sigue siendo un
    solo entero (`reemplazar_proyectos` no distingue ambos conteos hoy).
    Deliberadamente fuera de este cambio (Opción 2, registrada, no
    bloqueante) — ver docs/DECISIONES.md.

    `filas_ejecucion_reconocidas`/`filas_contratacion_reconocidas`
    ([HU-03][FE-01]) ya cierran: el dato ya existía completo en
    `ResultadoLectura.conteos` (`LectorEjecucion.leer`), solo faltaba
    propagarlo. `None` para PDT/PROYECTOS — no aplica a esos tipos.
    """

    tipo: str
    nombre_archivo: str
    filas_reconocidas: int
    filas_ejecucion_reconocidas: int | None = None
    filas_contratacion_reconocidas: int | None = None
    codigos: list[str]
    descartes: list[DescarteRespuesta]


def _a_dto(corte: Corte) -> CorteRespuesta:
    """Conversión explícita dominio -> DTO. Nunca se expone `Corte` directo."""
    return CorteRespuesta(
        id=corte.id,
        vigencia=corte.vigencia,
        fecha_corte=corte.fecha_corte,
        estado=corte.estado.value,
        archivos=[
            ArchivoFuenteRespuesta(
                tipo=archivo.tipo.value,
                reutilizado=archivo.reutilizado,
                corte_origen_id=archivo.corte_origen_id,
            )
            for archivo in corte.archivos.values()
        ],
    )


# --- Endpoints ---------------------------------------------------------------


@router.post("", response_model=CorteRespuesta, status_code=status.HTTP_201_CREATED)
def crear_corte(entrada: CorteEntrada, servicio: ServicioCortesDep) -> CorteRespuesta:
    """HU-01 / CA-1, CA-2.

    El 422 de fecha futura ya lo lanza `Corte.validar_fecha` (dominio) y ya
    está mapeado a HTTP en app/core/errores.py — no se maneja aquí.
    """
    corte = servicio.crear_corte(entrada.vigencia, entrada.fecha_corte)
    return _a_dto(corte)


@router.get("", response_model=list[CorteRespuesta])
def listar_cortes(servicio: ServicioCortesDep) -> list[CorteRespuesta]:
    """HU-01 / CA-8 (junto con GET /cortes/{id}): histórico de cortes."""
    return [_a_dto(corte) for corte in servicio.listar_cortes()]


@router.get("/{corte_id}", response_model=CorteRespuesta)
def obtener_corte(corte_id: UUID, servicio: ServicioCortesDep) -> CorteRespuesta:
    """HU-01 / CA-8 (junto con GET /cortes): detalle de un corte por id.

    El 404 ya lo lanza `ServicioCortes.obtener_corte` y ya está mapeado a
    HTTP en app/core/errores.py — no se maneja aquí.
    """
    return _a_dto(servicio.obtener_corte(corte_id))


@router.post(
    "/{corte_id}/archivos/{tipo}",
    response_model=ArchivoFuenteRespuestaParcial,
    status_code=status.HTTP_201_CREATED,
)
async def cargar_archivo(
    corte_id: UUID,
    tipo: TipoArchivoFuente,
    request: Request,
    servicio: ServicioCortesDep,
    configuracion: Annotated[Settings, Depends(get_settings)],
) -> ArchivoFuenteRespuestaParcial:
    """HU-02/CA-1, HU-03/CA-1, HU-04/CA-1: los 3 tipos cierran de punta a punta.

    `tipo` tipado con `TipoArchivoFuente` -> FastAPI valida automáticamente
    cualquier valor fuera del enum con 422, sin código adicional aquí.

    El guard que rechazaba EJECUCION/PROYECTOS con 501
    (`TipoArchivoNoDisponible`) se retiró: `RepositorioDatosCorteSQL.
    reemplazar_presupuesto` (`[HU-03][BE-06]`) y `LectorProyectos.leer`
    (`[HU-04][BE-01]`) ya no lanzan `NotImplementedError` en `develop`.
    Ver docs/TRAZABILIDAD.md (HU-03/CA-1, HU-04/CA-1) para la evidencia.

    Hallazgo transversal a HU-02/03/04, 2026-09-20 (corregido aquí y en
    `main.py`): antes se leía `archivo: UploadFile` completo a memoria
    (`await archivo.read()`) antes de que
    `validacion_archivos.py::_verificar_tamano` revisara el tamaño -- y
    además, sin overridear `max_part_size`, FastAPI llama `request.form()`
    con el límite de 1 MB por defecto de Starlette
    (`starlette/formparsers.py`), muy por debajo de `max_upload_bytes`
    (25 MB, `core/config.py`), y ese rechazo salía como un 400 genérico de
    Starlette en vez del 422/`ArchivoInvalido` de SEC-03.

    El corte real es de dos capas, no una sola (ver docs/SEGURIDAD.md,
    sección SEC-03):

    1. AQUÍ (esta función): filtro por `Content-Length` -- si el cliente
       declara el tamaño y ya excede el límite, se rechaza sin leer nada,
       con el 422/`ArchivoInvalido` estructurado de siempre (mismo
       `detalles` que produce `_verificar_tamano`, el frontend no ve
       ningún cambio de forma). Cubre el caso común y honesto.
    2. `main.py::crear_app` (`RequestBodyLimitMiddleware`, de
       `starlette.middleware.body_limit`): respaldo autoritativo a nivel
       ASGI, envuelve el `receive()` mismo y corta apenas se exceden los
       bytes reales, sin importar si `Content-Length` falta o miente
       (`chunked transfer-encoding` incluido) -- streaming real, nunca
       bufferea el body completo. Ese caso SÍ cambia de forma: responde
       413 con texto plano, no pasa por `ArchivoInvalido` (ver el
       comentario junto a `app.add_middleware(RequestBodyLimitMiddleware,
       ...)` en `main.py::crear_app` para el porqué). Es deliberado, no un
       descuido: es el único caso (cliente adversarial o con encoding sin
       `Content-Length`) donde no se pudo preservar el contrato 422 sin
       reimplementar el parseo multipart a mano.

    NOTA: `max_part_size` de `request.form()` NO protege archivos en la
    versión de Starlette instalada (`formparsers.py::on_part_data` solo
    aplica ese límite a campos de formulario sin `filename`, nunca a la
    parte que tiene un archivo -- verificado leyendo el código, no
    asumido) -- por eso el respaldo autoritativo vive en el middleware de
    `main.py`, no aquí. `request.form()` se llama sin ese parámetro,
    reemplazando el `archivo: UploadFile` inyectado automáticamente por
    FastAPI (que ya había disparado el límite roto de 1 MB antes de que
    este código pudiera ejecutarse).
    """
    limite = configuracion.max_upload_bytes

    content_length = request.headers.get("content-length")
    if content_length is not None and int(content_length) > limite:
        raise ArchivoInvalido(
            f"El archivo pesa {content_length} bytes; el máximo es {limite}.",
            detalles={
                "motivo": "tamano_excedido",
                "tamano": int(content_length),
                "tamano_max": limite,
            },
        )

    try:
        formulario = await request.form(max_files=1)
    except MultiPartException as exc:
        raise ArchivoInvalido(
            f"No se pudo interpretar la petición como un archivo válido: {exc}.",
            detalles={"motivo": "peticion_multipart_invalida"},
        ) from exc

    archivo = formulario.get("archivo")
    if not isinstance(archivo, UploadFile):
        raise ArchivoInvalido(
            "No se recibió un archivo en el campo 'archivo'.",
            detalles={"motivo": "archivo_vacio"},
        )

    contenido = await archivo.read()
    resultado = servicio.cargar_archivo(corte_id, tipo, contenido, archivo.filename)
    return ArchivoFuenteRespuestaParcial(
        tipo=resultado.tipo.value,
        nombre_archivo=resultado.nombre_archivo,
        filas_reconocidas=resultado.filas_reconocidas,
        filas_ejecucion_reconocidas=resultado.conteos.get("ejecucion"),
        filas_contratacion_reconocidas=resultado.conteos.get("contratacion"),
        codigos=[c.valor for c in resultado.codigos],
        descartes=[
            DescarteRespuesta(
                valor_crudo=descarte.valor_crudo,
                motivo=descarte.motivo,
                categoria=descarte.categoria,
            )
            for descarte in resultado.descartes
        ],
    )


@router.patch("/{corte_id}", response_model=CorteRespuesta)
def corregir_corte(
    corte_id: UUID, entrada: CorteCorreccion, servicio: ServicioCortesDep
) -> CorteRespuesta:
    """D11 (docs/DECISIONES.md, aclaración 2026-09-19): corrige vigencia/
    fecha de un corte en BORRADOR.

    404 (corte inexistente), 409 (corte no está en BORRADOR, o vigencia+
    fecha duplicada contra OTRO corte) y 422 (fecha futura) ya los lanza
    `ServicioCortes.corregir_corte` (dominio + aplicación) y ya están
    mapeados a HTTP en app/core/errores.py — no se manejan aquí.
    """
    corte = servicio.corregir_corte(corte_id, entrada.vigencia, entrada.fecha_corte)
    return _a_dto(corte)


@router.post("/{corte_id}/registrar", response_model=CorteRespuesta)
def registrar_corte(corte_id: UUID, servicio: ServicioCortesDep) -> CorteRespuesta:
    """HU-01 / CA-3, CA-4: transición BORRADOR -> REGISTRADO.

    404 (corte inexistente) y 409 (falta algún archivo obligatorio, con
    `detalles` indicando cuál) ya los lanza `ServicioCortes.registrar_corte`
    (dominio + aplicación, `Corte.registrar()`) y ya están mapeados a HTTP en
    app/core/errores.py — no se manejan aquí, mismo patrón que
    `corregir_corte`.
    """
    corte = servicio.registrar_corte(corte_id)
    return _a_dto(corte)
