"""Pruebas del endpoint de estado.

TARJETA: [DEV-07] (parte de código)

/health no depende de la base de datos (no usa SesionDep), por lo que se
prueba con la app tal cual, sin overrides de dependencias — a diferencia
de test_router_cortes.py, que sí necesita sobreescribir ServicioCortesDep.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import crear_app


# /api/v1/salud (el alias) ya está cubierto por
# tests/test_salud.py::test_la_aplicacion_responde — no se duplica aquí.
def test_health_devuelve_200_ok():
    cliente = TestClient(crear_app())

    respuesta = cliente.get("/health")

    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}


def test_413_por_cuerpo_excedido_conserva_cabeceras_cors(monkeypatch):
    """CORSMiddleware debe ser el middleware más externo: si
    RequestBodyLimitMiddleware lo envuelve, su 413 sale sin
    `access-control-allow-origin` y el navegador lo muestra como error de
    CORS en vez de "archivo demasiado grande". `max_body_size` se fija al
    construir la app, por eso se baja por variable de entorno antes de
    `crear_app()` (ver test_router_cortes.py, prueba del 413)."""
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "20")
    get_settings.cache_clear()
    try:
        origen = get_settings().cors_origins_list[0]
        cliente = TestClient(crear_app())

        respuesta = cliente.post("/api/v1/cortes", content=b"A" * 100, headers={"Origin": origen})

        assert respuesta.status_code == 413
        assert respuesta.headers.get("access-control-allow-origin") == origen
    finally:
        get_settings.cache_clear()
