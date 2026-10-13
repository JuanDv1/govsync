"""Adaptador de VerificadorToken contra Keycloak.

CAPA: Persistencia
TARJETA: [HU-E01-01] Autenticación con Keycloak
CUBRE: E-01 (Gestión de Acceso y Roles) — ver docs/DECISIONES.md D23

=============================================================================
QUÉ HACE
=============================================================================
Implementa `identidad/domain/puertos.py::VerificadorToken` contra un Keycloak
real: descarga (y cachea) el JWKS del realm, valida la firma RS256, el
emisor (`iss`) y la audiencia (`aud`), y construye un `Usuario` de dominio a
partir de los claims `sub`/`email`/`realm_access.roles`.

=============================================================================
POR QUÉ `audience` ES OBLIGATORIO, NO OPCIONAL
=============================================================================
Sin verificar `aud`, un token emitido por Keycloak para OTRO cliente (otra
aplicación registrada en el mismo realm) sería aceptado igual aquí. Exigirlo
por constructor, sin valor por defecto, evita que alguien lo omita sin
darse cuenta — mismo criterio que `config.py::secret_key` no tiene un
default usable en producción.

=============================================================================
POR QUÉ ESTA CLASE NO LEE `app.core.config` DIRECTAMENTE
=============================================================================
Recibe `issuer`/`audience`/`jwks_url` por constructor en vez de llamar
`get_settings()` internamente — quien la instancie (la dependencia de
FastAPI en `core/dependencias.py`) lee la configuración una sola vez. Así
esta clase se puede probar con cualquier emisor/audiencia falsos, sin
tocar variables de entorno.

RESTRICCIÓN ARQUITECTÓNICA: esta es la capa de persistencia, por eso SÍ
puede importar una librería de JWT (PyJWT) — lo que no puede es filtrarse
hacia `domain/`. Lo verifica tests/test_arquitectura.py.
"""

from __future__ import annotations

import jwt
from jwt import PyJWKClient

from app.modules.identidad.domain.entidades import Rol, Usuario
from app.modules.identidad.domain.puertos import VerificadorToken
from app.shared.errors import CredencialesInvalidas

_ROLES_VALIDOS: frozenset[str] = frozenset(rol.value for rol in Rol)


class VerificadorTokenKeycloak(VerificadorToken):
    def __init__(self, *, issuer: str, audience: str, jwks_url: str | None = None) -> None:
        self._issuer = issuer
        self._audience = audience
        # Endpoint estándar de Keycloak para el JWKS del realm. PyJWKClient
        # cachea el conjunto de claves 5 minutos por defecto: no se golpea
        # Keycloak en cada request.
        self._jwks_client = PyJWKClient(jwks_url or f"{issuer}/protocol/openid-connect/certs")

    def verificar(self, token: str) -> Usuario:
        try:
            clave_firmante = self._jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                clave_firmante.key,
                algorithms=["RS256"],
                issuer=self._issuer,
                audience=self._audience,
            )
        except jwt.PyJWTError as exc:
            raise CredencialesInvalidas("El token no es válido o expiró.") from exc

        sub = claims.get("sub")
        correo = claims.get("email")
        if not sub or not correo:
            raise CredencialesInvalidas(
                "El token de Keycloak no tiene los claims esperados (sub/email)."
            )

        roles_crudos = claims.get("realm_access", {}).get("roles", [])
        roles = frozenset(Rol(r) for r in roles_crudos if r in _ROLES_VALIDOS)

        return Usuario(id=sub, correo=correo, roles=roles)
