"""Traducción centralizada de errores de dominio a respuestas HTTP.

Capa: API. Es el ÚNICO lugar que conoce el mapa error de negocio -> código HTTP.
Los casos de uso lanzan excepciones de dominio y no saben nada de HTTP.
`respuesta_de_error` también la usa `core/limite_peticiones.py`, que corre
fuera de los manejadores de excepciones de FastAPI.

Seguridad (OWASP A05 — mala configuración de seguridad): un error no previsto
nunca devuelve la traza ni el mensaje interno al cliente; se registra en el log
del servidor y se responde con un mensaje genérico.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.shared.errors import (
    ArchivoInvalido,
    CredencialesInvalidas,
    GovSyncError,
    LimiteDePeticionesExcedido,
    OperacionNoPermitida,
    PermisoInsuficiente,
    RecursoNoEncontrado,
    ReglaDeNegocioViolada,
)

_log = logging.getLogger("govsync")

_MAPA_HTTP: dict[type[GovSyncError], int] = {
    CredencialesInvalidas: status.HTTP_401_UNAUTHORIZED,
    PermisoInsuficiente: status.HTTP_403_FORBIDDEN,
    OperacionNoPermitida: status.HTTP_409_CONFLICT,
    RecursoNoEncontrado: status.HTTP_404_NOT_FOUND,
    ReglaDeNegocioViolada: status.HTTP_422_UNPROCESSABLE_CONTENT,
    LimiteDePeticionesExcedido: status.HTTP_429_TOO_MANY_REQUESTS,
    ArchivoInvalido: status.HTTP_422_UNPROCESSABLE_CONTENT,
}


def respuesta_de_error(exc: GovSyncError, headers: dict[str, str] | None = None) -> JSONResponse:
    """Sobre `{codigo, mensaje, detalles}` de un error de dominio. Es el único
    lugar que lo arma: lo usa el manejador de abajo y también el middleware de
    límite de peticiones, que corre fuera del alcance de los manejadores de
    excepciones de FastAPI (por eso no puede limitarse a hacer `raise`)."""
    return JSONResponse(
        status_code=_MAPA_HTTP.get(type(exc), status.HTTP_400_BAD_REQUEST),
        content={"codigo": exc.codigo, "mensaje": exc.mensaje, "detalles": exc.detalles},
        headers=headers,
    )


_CODIGOS_DE_ACCESO_RECHAZADO = (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(GovSyncError)
    async def _manejar_error_dominio(request: Request, exc: GovSyncError) -> JSONResponse:
        codigo_http = _MAPA_HTTP.get(type(exc), status.HTTP_400_BAD_REQUEST)
        if codigo_http in _CODIGOS_DE_ACCESO_RECHAZADO:
            # OWASP A09: los intentos de acceso rechazados quedan registrados.
            # Solo método, ruta y motivo: nunca el token ni datos del usuario.
            _log.warning(
                "Acceso rechazado (%s %s) en %s %s",
                codigo_http,
                exc.codigo,
                request.method,
                request.url.path,
            )
        return respuesta_de_error(exc)

    @app.exception_handler(Exception)
    async def _manejar_error_no_previsto(request: Request, exc: Exception) -> JSONResponse:
        _log.exception("Error no controlado en %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "codigo": "error_interno",
                "mensaje": "Ocurrió un error inesperado procesando la solicitud.",
                "detalles": {},
            },
        )
