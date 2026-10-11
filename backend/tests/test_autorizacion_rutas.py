"""Pruebas de autorización de extremo a extremo en los routers HTTP.

TARJETA: [HU-E01-02] · CAPA: API
CUBRE (D24, docs/DECISIONES.md):
- sin token -> 401, tanto en un endpoint de lectura como en uno de escritura
- rol visitante -> 200 en lectura, 403 en escritura (con roles_requeridos)
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.database import get_session
from app.core.dependencias import obtener_usuario_actual
from app.main import crear_app
from app.modules.identidad.domain.entidades import Rol, Usuario

_USUARIO_VISITANTE = Usuario(
    id="v1", correo="visitante@santarosa.gov.co", roles=frozenset({Rol.VISITANTE})
)


def _cliente_con_sesion_real_sin_usuario(sesion) -> TestClient:
    """Cliente que NO sobreescribe obtener_usuario_actual — a diferencia del
    `cliente` de conftest.py, para ejercitar de verdad HTTPBearer +
    obtener_usuario_actual ante la ausencia de token."""
    app = crear_app()

    def _sesion_de_prueba():
        yield sesion

    app.dependency_overrides[get_session] = _sesion_de_prueba
    return TestClient(app)


class TestSinToken:
    def test_get_cortes_sin_token_devuelve_401(self, sesion) -> None:
        cliente = _cliente_con_sesion_real_sin_usuario(sesion)

        respuesta = cliente.get("/api/v1/cortes")

        assert respuesta.status_code == 401
        assert respuesta.json()["codigo"] == "credenciales_invalidas"

    def test_post_cortes_sin_token_devuelve_401(self, sesion) -> None:
        cliente = _cliente_con_sesion_real_sin_usuario(sesion)

        respuesta = cliente.post(
            "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
        )

        assert respuesta.status_code == 401


class TestRolVisitante:
    def test_visitante_puede_leer(self, cliente) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _USUARIO_VISITANTE

        respuesta = cliente.get("/api/v1/cortes")

        assert respuesta.status_code == 200

    def test_visitante_no_puede_crear_un_corte(self, cliente) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _USUARIO_VISITANTE

        respuesta = cliente.post(
            "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
        )

        assert respuesta.status_code == 403
        cuerpo = respuesta.json()
        assert cuerpo["codigo"] == "permiso_insuficiente"
        assert set(cuerpo["detalles"]["roles_requeridos"]) == {"administrador", "gestor"}
