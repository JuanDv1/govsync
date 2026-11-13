"""E-01/HU-01 CA05 de punta a punta con un token RS256 real.

TARJETA: [E-01/HU-01] BE - Exigir rol válido en todas las rutas protegidas
(CA05). Prueba de QA (Juan Esteban, Tester) al pasar la tarjeta a TESTING.

Qué agrega respecto a las pruebas que ya existen:
- `test_ca05_sin_rol_todas_las_rutas.py` recorre todas las rutas, pero con
  un verificador falso que ya devuelve un `Usuario` sin roles.
- `test_keycloak.py` prueba el verificador, pero sin pasar por HTTP.

Aquí el token se firma de verdad (llave RSA en memoria) y pasa por la
cadena completa: encabezado `Authorization` -> `VerificadorTokenKeycloak`
real (solo se sustituye la descarga del JWKS) -> `obtener_usuario_actual`
-> router -> manejador de errores. Así se comprueba lo que Keycloak manda
en la práctica: toda cuenta trae roles propios del realm
(`default-roles-govsync`, `offline_access`, `uma_authorization`), y esos
NO deben contar como un rol de GovSync.
"""

from __future__ import annotations

import logging
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.core.database import get_session
from app.core.dependencias import obtener_verificador_token
from app.main import crear_app
from app.modules.identidad.persistence.keycloak import VerificadorTokenKeycloak

ISSUER = "https://kc.ejemplo.test/realms/govsync"
AUDIENCE = "govsync-backend"
RUTA = "/api/v1/cortes"

#: Roles que Keycloak agrega a toda cuenta del realm.
ROLES_PROPIOS_DEL_REALM = ["default-roles-govsync", "offline_access", "uma_authorization"]


@pytest.fixture(scope="module")
def llave_privada():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _ClaveFirmante:
    def __init__(self, clave_publica) -> None:
        self.key = clave_publica


@pytest.fixture()
def cliente_con_verificador_real(sesion, llave_privada):
    verificador = VerificadorTokenKeycloak(issuer=ISSUER, audience=AUDIENCE)
    publica = llave_privada.public_key()
    # Única sustitución: la descarga del JWKS (sería una llamada de red a
    # Keycloak). Firma, emisor, audiencia y roles se validan de verdad.
    verificador._jwks_client.get_signing_key_from_jwt = lambda _token: _ClaveFirmante(publica)

    app = crear_app()

    def _sesion_de_prueba():
        yield sesion

    app.dependency_overrides[get_session] = _sesion_de_prueba
    app.dependency_overrides[obtener_verificador_token] = lambda: verificador
    with TestClient(app) as cliente:
        yield cliente


def _token(llave_privada, **cambios) -> str:
    ahora = int(time.time())
    claims = {
        "sub": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "email": "usuaria@santarosa.gov.co",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": ahora,
        "exp": ahora + 300,
    }
    claims.update(cambios)
    claims = {k: v for k, v in claims.items() if v is not _QUITAR}
    return jwt.encode(claims, llave_privada, algorithm="RS256")


_QUITAR = object()


def _get(cliente, token: str):
    return cliente.get(RUTA, headers={"Authorization": f"Bearer {token}"})


def _es_sin_rol(respuesta) -> bool:
    return (
        respuesta.status_code == 403
        and respuesta.json()["codigo"] == "permiso_insuficiente"
        and respuesta.json()["detalles"]["motivo"] == "sin_rol_asignado"
    )


class TestCuentaSinRolDeGovSync:
    """CA05: credenciales válidas, pero ningún rol de GovSync -> 403."""

    def test_solo_con_los_roles_propios_del_realm(
        self, cliente_con_verificador_real, llave_privada
    ):
        """Es el caso real de una cuenta recién creada en Keycloak."""
        token = _token(llave_privada, realm_access={"roles": ROLES_PROPIOS_DEL_REALM})

        assert _es_sin_rol(_get(cliente_con_verificador_real, token))

    def test_con_la_lista_de_roles_vacia(self, cliente_con_verificador_real, llave_privada):
        token = _token(llave_privada, realm_access={"roles": []})

        assert _es_sin_rol(_get(cliente_con_verificador_real, token))

    def test_sin_el_claim_realm_access(self, cliente_con_verificador_real, llave_privada):
        """Keycloak omite el claim si al cliente le quitan el scope `roles`."""
        token = _token(llave_privada, realm_access=_QUITAR)

        assert _es_sin_rol(_get(cliente_con_verificador_real, token))

    def test_con_el_rol_solo_como_rol_de_cliente(self, cliente_con_verificador_real, llave_privada):
        """GovSync lee roles del REALM (D23). Un `administrador` creado por
        error como rol de cliente no da acceso: se trata como sin rol."""
        token = _token(
            llave_privada,
            realm_access={"roles": ROLES_PROPIOS_DEL_REALM},
            resource_access={"govsync-frontend": {"roles": ["administrador"]}},
        )

        assert _es_sin_rol(_get(cliente_con_verificador_real, token))

    @pytest.mark.parametrize(
        "parecido", ["Administrador", "ADMINISTRADOR", " administrador", "admin"]
    )
    def test_un_nombre_parecido_no_cuenta_como_rol(
        self, cliente_con_verificador_real, llave_privada, parecido: str
    ):
        token = _token(llave_privada, realm_access={"roles": [parecido]})

        assert _es_sin_rol(_get(cliente_con_verificador_real, token))

    def test_el_mensaje_no_expone_el_token_ni_datos_de_la_cuenta(
        self, cliente_con_verificador_real, llave_privada
    ):
        token = _token(llave_privada, realm_access={"roles": []})

        cuerpo = _get(cliente_con_verificador_real, token).text

        assert token not in cuerpo
        assert "usuaria@santarosa.gov.co" not in cuerpo
        assert "f47ac10b" not in cuerpo

    def test_el_rechazo_queda_en_el_log_sin_el_token(
        self, cliente_con_verificador_real, llave_privada, caplog
    ):
        token = _token(llave_privada, realm_access={"roles": []})

        with caplog.at_level(logging.WARNING, logger="govsync"):
            _get(cliente_con_verificador_real, token)

        assert "Acceso rechazado (403 permiso_insuficiente) en GET /api/v1/cortes" in caplog.text
        assert token not in caplog.text


class TestControles:
    """Lo que NO es CA05 no debe confundirse con CA05."""

    def test_con_un_rol_de_govsync_entra(self, cliente_con_verificador_real, llave_privada):
        token = _token(
            llave_privada, realm_access={"roles": [*ROLES_PROPIOS_DEL_REALM, "visitante"]}
        )

        assert _get(cliente_con_verificador_real, token).status_code == 200

    def test_sin_token_es_401_no_403(self, cliente_con_verificador_real):
        assert cliente_con_verificador_real.get(RUTA).status_code == 401

    def test_token_vencido_es_401_aunque_no_tenga_rol(
        self, cliente_con_verificador_real, llave_privada
    ):
        """El orden importa: primero se valida el token; un token vencido
        nunca llega a la regla de roles."""
        ahora = int(time.time())
        token = _token(llave_privada, realm_access={"roles": []}, iat=ahora - 600, exp=ahora - 60)

        respuesta = _get(cliente_con_verificador_real, token)

        assert respuesta.status_code == 401
        assert respuesta.json()["codigo"] == "credenciales_invalidas"

    def test_token_firmado_con_otra_llave_es_401(self, cliente_con_verificador_real):
        otra = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        token = _token(otra, realm_access={"roles": ["administrador"]})

        assert _get(cliente_con_verificador_real, token).status_code == 401
