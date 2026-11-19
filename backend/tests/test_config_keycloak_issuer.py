"""KEYCLOAK_ISSUER en producción (docs/DESPLIEGUE.md, D39).

El backend compara `iss` por igualdad exacta con lo que Keycloak firma
(KC_HOSTNAME + /realms/govsync): un issuer mal escrito no falla al arrancar sino
en cada petición, con 401. Por eso la configuración lo valida al cargar.
"""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

BASE = {"database_url": "sqlite+pysqlite:///:memory:"}
ISSUER = "https://govsync-keycloak.onrender.com/realms/govsync"


def _ajustes(**kw) -> Settings:
    return Settings(_env_file=None, **{**BASE, **kw})


def test_produccion_acepta_issuer_https():
    assert _ajustes(environment="production", keycloak_issuer=ISSUER).keycloak_issuer == ISSUER


def test_produccion_normaliza_la_barra_final():
    ajustes = _ajustes(environment="production", keycloak_issuer=ISSUER + "/")
    assert ajustes.keycloak_issuer == ISSUER


def test_produccion_rechaza_http_con_mensaje_claro():
    with pytest.raises(ValidationError, match="https://"):
        _ajustes(environment="production", keycloak_issuer=ISSUER.replace("https", "http"))


def test_produccion_sigue_rechazando_localhost():
    with pytest.raises(ValidationError, match="explícitamente"):
        _ajustes(environment="production", keycloak_issuer="https://localhost:8443/realms/govsync")


def test_desarrollo_conserva_http_local_y_tambien_normaliza():
    ajustes = _ajustes(
        environment="development", keycloak_issuer="http://localhost:8080/realms/govsync/"
    )
    assert ajustes.keycloak_issuer == "http://localhost:8080/realms/govsync"
