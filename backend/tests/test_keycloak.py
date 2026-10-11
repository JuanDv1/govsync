"""Pruebas del adaptador VerificadorTokenKeycloak.

TARJETA: [HU-E01-01] · CAPA: Persistencia
CUBRE:
- token válido con roles reconocidos
- roles desconocidos (no de nuestro vocabulario) se filtran sin error
- token expirado, firma inválida, issuer/audience que no coinciden
- claims sub/email faltantes

No hay llamadas de red: se genera un par de llaves RSA en memoria y se
mockea PyJWKClient.get_signing_key_from_jwt para que devuelva la pública,
simulando lo que Keycloak respondería desde su JWKS real.
"""

from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.modules.identidad.domain.entidades import Rol
from app.modules.identidad.persistence.keycloak import VerificadorTokenKeycloak
from app.shared.errors import CredencialesInvalidas

ISSUER = "https://kc.ejemplo.test/realms/govsync"
AUDIENCE = "govsync-backend"


@pytest.fixture(scope="module")
def llaves_rsa():
    privada = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return privada, privada.public_key()


class _ClaveFirmanteFalsa:
    def __init__(self, clave_publica) -> None:
        self.key = clave_publica


def _firmar(llaves_rsa, claims: dict) -> str:
    privada, _ = llaves_rsa
    return jwt.encode(claims, privada, algorithm="RS256")


def _claims_base(**overrides) -> dict:
    ahora = int(time.time())
    base = {
        "sub": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "email": "usuaria@santarosa.gov.co",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": ahora,
        "exp": ahora + 300,
        "realm_access": {"roles": ["gestor"]},
    }
    base.update(overrides)
    return base


def _verificador(llaves_rsa) -> VerificadorTokenKeycloak:
    _, publica = llaves_rsa
    verificador = VerificadorTokenKeycloak(issuer=ISSUER, audience=AUDIENCE)
    # Sustituye la búsqueda real en el JWKS de Keycloak por la pública que
    # generamos en memoria — sin esto, get_signing_key_from_jwt intentaría
    # una llamada de red real a ISSUER.
    verificador._jwks_client.get_signing_key_from_jwt = lambda _token: _ClaveFirmanteFalsa(publica)
    return verificador


class TestTokenValido:
    def test_token_valido_con_rol_reconocido(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        token = _firmar(llaves_rsa, _claims_base())

        usuario = verificador.verificar(token)

        assert usuario.id == "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        assert usuario.correo == "usuaria@santarosa.gov.co"
        assert usuario.tiene_rol(Rol.GESTOR)

    def test_roles_desconocidos_se_filtran_sin_error(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        token = _firmar(
            llaves_rsa,
            _claims_base(realm_access={"roles": ["offline_access", "administrador"]}),
        )

        usuario = verificador.verificar(token)

        assert usuario.roles == frozenset({Rol.ADMINISTRADOR})

    def test_usuario_sin_ningun_rol_reconocido_queda_sin_roles(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        token = _firmar(llaves_rsa, _claims_base(realm_access={"roles": ["uma_authorization"]}))

        usuario = verificador.verificar(token)

        assert usuario.roles == frozenset()


class TestTokenInvalido:
    def test_token_expirado_lanza_credenciales_invalidas(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        ahora = int(time.time())
        token = _firmar(llaves_rsa, _claims_base(iat=ahora - 600, exp=ahora - 300))

        with pytest.raises(CredencialesInvalidas):
            verificador.verificar(token)

    def test_issuer_distinto_lanza_credenciales_invalidas(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        token = _firmar(llaves_rsa, _claims_base(iss="https://otro-realm.test/realms/otro"))

        with pytest.raises(CredencialesInvalidas):
            verificador.verificar(token)

    def test_audience_distinta_lanza_credenciales_invalidas(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        token = _firmar(llaves_rsa, _claims_base(aud="otra-app"))

        with pytest.raises(CredencialesInvalidas):
            verificador.verificar(token)

    def test_firma_invalida_lanza_credenciales_invalidas(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        otra_privada = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        token = jwt.encode(_claims_base(), otra_privada, algorithm="RS256")

        with pytest.raises(CredencialesInvalidas):
            verificador.verificar(token)

    def test_claim_sub_faltante_lanza_credenciales_invalidas(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        claims = _claims_base()
        del claims["sub"]
        token = _firmar(llaves_rsa, claims)

        with pytest.raises(CredencialesInvalidas):
            verificador.verificar(token)

    def test_claim_email_faltante_lanza_credenciales_invalidas(self, llaves_rsa) -> None:
        verificador = _verificador(llaves_rsa)
        claims = _claims_base()
        del claims["email"]
        token = _firmar(llaves_rsa, claims)

        with pytest.raises(CredencialesInvalidas):
            verificador.verificar(token)
