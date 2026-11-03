"""E-01/HU-01 CA05: una cuenta con credenciales válidas pero SIN rol no
accede a ningún módulo, ni siquiera de lectura.

TARJETA: [E-01/HU-01] BE - Exigir rol válido en todas las rutas (CA05).
La regla ya vive en `obtener_usuario_actual` (app/core/dependencias.py) y
tiene prueba unitaria en `test_dependencias_identidad.py`. Lo que faltaba
comprobar (lo pide la propia tarjeta) es que TODAS las rutas pasen por esa
dependencia.

Las rutas se leen del esquema OpenAPI de la app en vez de listarse a mano:
si alguien agrega un endpoint nuevo sin `UsuarioActualDep`/`exigir_roles`,
esta prueba lo detecta sin que nadie tenga que acordarse de actualizarla.
Solo se excluyen los chequeos de salud, que son públicos a propósito.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_session
from app.core.dependencias import obtener_verificador_token
from app.main import crear_app
from app.modules.identidad.domain.entidades import Usuario

RUTAS_PUBLICAS = {"/health", "/api/v1/salud"}
PARAMETROS_DE_RUTA = {
    "{corte_id}": str(uuid.uuid4()),
    "{tipo}": "PDT",
}


class _VerificadorQueDevuelveUsuarioSinRol:
    """Simula un token válido de Keycloak cuyo usuario no tiene ningún rol
    de GovSync asignado."""

    def verificar(self, _token: str) -> Usuario:
        return Usuario(id="sin-rol", correo="sinrol@santarosa.gov.co", roles=frozenset())


def _rutas_protegidas() -> list[tuple[str, str]]:
    esquema = crear_app().openapi()
    return sorted(
        (metodo.upper(), ruta)
        for ruta, operaciones in esquema["paths"].items()
        if ruta not in RUTAS_PUBLICAS
        for metodo in operaciones
    )


def test_hay_rutas_que_verificar() -> None:
    """Protege contra un falso verde: si el esquema cambiara de forma y la
    lista quedara vacía, la prueba parametrizada no correría ningún caso."""
    assert len(_rutas_protegidas()) >= 10


@pytest.mark.parametrize(("metodo", "ruta"), _rutas_protegidas())
def test_ca05_usuario_sin_rol_recibe_403_en_toda_ruta(sesion, metodo: str, ruta: str) -> None:
    app = crear_app()

    def _sesion_de_prueba():
        yield sesion

    app.dependency_overrides[get_session] = _sesion_de_prueba
    app.dependency_overrides[obtener_verificador_token] = _VerificadorQueDevuelveUsuarioSinRol

    url = ruta
    for marcador, valor in PARAMETROS_DE_RUTA.items():
        url = url.replace(marcador, valor)
    assert "{" not in url, f"Parámetro de ruta sin valor de prueba: {ruta}"

    with TestClient(app) as cliente:
        respuesta = cliente.request(metodo, url, headers={"Authorization": "Bearer token"})

    assert respuesta.status_code == 403, respuesta.text
    assert respuesta.json()["detalles"]["motivo"] == "sin_rol_asignado"
