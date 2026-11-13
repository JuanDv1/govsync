"""E-01/HU-01: el rol `gestor` no tiene módulos habilitados en esta versión.

TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
DECISIÓN: D37 (docs/DECISIONES.md, PO 2026-11-11). La función del gestor es
la Épica 3, fuera del Sprint 3. Ocultar las pantallas en el frontend no
basta: el backend debe rechazarlo en TODA ruta, de lectura y de escritura.

Mismo patrón que `test_ca05_sin_rol_todas_las_rutas.py`: las rutas se leen
del esquema OpenAPI, así que un endpoint nuevo que deje entrar al gestor
hace fallar esta prueba sin que nadie tenga que actualizarla. El token pasa
por el verificador real de la cadena de dependencias (solo se sustituye el
verificador de Keycloak), no por un override de `obtener_usuario_actual`.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_session
from app.core.dependencias import obtener_verificador_token
from app.main import crear_app
from app.modules.identidad.domain.entidades import Rol, Usuario
from tests.test_ca05_sin_rol_todas_las_rutas import (
    PARAMETROS_DE_RUTA,
    _rutas_protegidas,
)


def _verificador_con_roles(*roles: Rol):
    """Simula un token válido de Keycloak con los roles dados."""

    class _Verificador:
        def verificar(self, _token: str) -> Usuario:
            return Usuario(id="u1", correo="u1@santarosa.gov.co", roles=frozenset(roles))

    return _Verificador


def _pedir(sesion, roles: tuple[Rol, ...], metodo: str, ruta: str):
    app = crear_app()

    def _sesion_de_prueba():
        yield sesion

    app.dependency_overrides[get_session] = _sesion_de_prueba
    app.dependency_overrides[obtener_verificador_token] = _verificador_con_roles(*roles)

    url = ruta
    for marcador, valor in PARAMETROS_DE_RUTA.items():
        url = url.replace(marcador, valor)
    assert "{" not in url, f"Parámetro de ruta sin valor de prueba: {ruta}"

    with TestClient(app) as cliente:
        return cliente.request(metodo, url, headers={"Authorization": "Bearer token"})


def test_hay_rutas_que_verificar() -> None:
    """Protege contra un falso verde si la lista quedara vacía."""
    assert len(_rutas_protegidas()) >= 10


@pytest.mark.parametrize(("metodo", "ruta"), _rutas_protegidas())
def test_gestor_recibe_403_en_toda_ruta(sesion, metodo: str, ruta: str) -> None:
    respuesta = _pedir(sesion, (Rol.GESTOR,), metodo, ruta)

    assert respuesta.status_code == 403, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["codigo"] == "permiso_insuficiente"
    assert "gestor" not in cuerpo["detalles"]["roles_requeridos"]


# --- Regresión: D37 no le quita nada a los roles que sí tienen módulos ------
# Sin esto, pasar las lecturas a `LecturaDep` podría dejar al visitante sin
# la matriz o el historial y ninguna prueba lo notaría (hallazgo del
# Agente 3, verificado por mutación). "No 403" basta: el 404/409/422 que
# devuelve cada ruta con los datos de prueba vacíos es posterior a la
# autorización.

_LECTURAS = [(m, r) for m, r in _rutas_protegidas() if m == "GET"]


@pytest.mark.parametrize(("metodo", "ruta"), _rutas_protegidas())
def test_administrador_no_recibe_403_en_ninguna_ruta(sesion, metodo: str, ruta: str) -> None:
    respuesta = _pedir(sesion, (Rol.ADMINISTRADOR,), metodo, ruta)

    assert respuesta.status_code != 403, respuesta.text


@pytest.mark.parametrize(("metodo", "ruta"), _LECTURAS)
def test_visitante_no_recibe_403_en_ninguna_lectura(sesion, metodo: str, ruta: str) -> None:
    respuesta = _pedir(sesion, (Rol.VISITANTE,), metodo, ruta)

    assert respuesta.status_code != 403, respuesta.text


def test_gestor_con_otro_rol_entra_con_los_permisos_del_otro(sesion) -> None:
    """D37: gestor + visitante lee como visitante y no escribe."""
    lectura = _pedir(sesion, (Rol.GESTOR, Rol.VISITANTE), "GET", "/api/v1/cortes")
    escritura = _pedir(sesion, (Rol.GESTOR, Rol.VISITANTE), "POST", "/api/v1/cortes")

    assert lectura.status_code == 200
    assert escritura.status_code == 403


def test_administrador_conserva_la_escritura(cliente) -> None:
    """Control: el cambio de D37 no le quita la escritura a quien sí la
    tiene. El fixture `cliente` usa ADMINISTRADOR (conftest.py)."""
    respuesta = cliente.post("/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"})

    assert respuesta.status_code == 201
