"""Hallazgo de QA (2026-11-17): /docs, /redoc y /openapi.json responden sin
token y describen toda la API. En producción deben quedar apagadas, salvo
`DOCS_API_EN_PRODUCCION=true`; en local y pruebas siguen disponibles."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import crear_app

RUTAS_DE_DOCUMENTACION = ["/docs", "/redoc", "/openapi.json"]


def _app_con_entorno(monkeypatch, **entorno: str):
    monkeypatch.setenv("KEYCLOAK_ISSUER", "https://keycloak.ejemplo.co/realms/govsync")
    for nombre, valor in entorno.items():
        monkeypatch.setenv(nombre, valor)
    get_settings.cache_clear()
    return crear_app()


@pytest.fixture(autouse=True)
def _limpiar_cache_de_ajustes():
    yield
    get_settings.cache_clear()


@pytest.mark.parametrize("ruta", RUTAS_DE_DOCUMENTACION)
def test_en_produccion_la_documentacion_no_se_sirve(monkeypatch, ruta) -> None:
    app = _app_con_entorno(monkeypatch, ENVIRONMENT="production")
    with TestClient(app) as cliente:
        assert cliente.get(ruta).status_code == 404


def test_en_produccion_la_api_y_el_health_siguen_funcionando(monkeypatch) -> None:
    app = _app_con_entorno(monkeypatch, ENVIRONMENT="production")
    with TestClient(app) as cliente:
        assert cliente.get("/health").status_code == 200
        assert cliente.get("/api/v1/plan-accion/actual").status_code == 401


@pytest.mark.parametrize("ruta", RUTAS_DE_DOCUMENTACION)
def test_en_produccion_se_puede_reactivar_expresamente(monkeypatch, ruta) -> None:
    app = _app_con_entorno(monkeypatch, ENVIRONMENT="production", DOCS_API_EN_PRODUCCION="true")
    with TestClient(app) as cliente:
        assert cliente.get(ruta).status_code == 200


@pytest.mark.parametrize("entorno", ["development", "test"])
@pytest.mark.parametrize("ruta", RUTAS_DE_DOCUMENTACION)
def test_fuera_de_produccion_la_documentacion_sigue_disponible(monkeypatch, entorno, ruta) -> None:
    app = _app_con_entorno(monkeypatch, ENVIRONMENT=entorno)
    with TestClient(app) as cliente:
        assert cliente.get(ruta).status_code == 200
