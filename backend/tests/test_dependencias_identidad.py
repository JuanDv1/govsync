"""Pruebas de las dependencias de autenticación/autorización.

TARJETA: [HU-E01-01] · CAPA: API
CUBRE:
- obtener_usuario_actual: sin header -> CredencialesInvalidas; token válido
  (verificador falso) -> devuelve el Usuario; usuario sin ningún rol ->
  PermisoInsuficiente (HU01-CA05 del Excel E-01: "no le da acceso a ningún
  módulo")
- exigir_roles: con el rol requerido deja pasar; sin él -> PermisoInsuficiente
  con roles_requeridos en detalles
"""

from __future__ import annotations

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.core.dependencias import exigir_roles, obtener_usuario_actual
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.modules.identidad.domain.puertos import VerificadorToken
from app.shared.errors import CredencialesInvalidas, PermisoInsuficiente

_USUARIO_GESTOR = Usuario(id="u1", correo="gestor@santarosa.gov.co", roles=frozenset({Rol.GESTOR}))
_USUARIO_SIN_ROLES = Usuario(id="u2", correo="nuevo@santarosa.gov.co", roles=frozenset())


class _VerificadorFalso(VerificadorToken):
    def __init__(self, usuario: Usuario) -> None:
        self._usuario = usuario

    def verificar(self, token: str) -> Usuario:
        assert token == "token-valido"
        return self._usuario


class TestObtenerUsuarioActual:
    def test_sin_header_lanza_credenciales_invalidas(self) -> None:
        verificador = _VerificadorFalso(_USUARIO_GESTOR)

        with pytest.raises(CredencialesInvalidas):
            obtener_usuario_actual(credenciales=None, verificador=verificador)

    def test_token_valido_devuelve_el_usuario(self) -> None:
        credenciales = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token-valido")

        usuario = obtener_usuario_actual(
            credenciales=credenciales, verificador=_VerificadorFalso(_USUARIO_GESTOR)
        )

        assert usuario is _USUARIO_GESTOR

    def test_usuario_sin_ningun_rol_lanza_permiso_insuficiente(self) -> None:
        credenciales = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token-valido")

        with pytest.raises(PermisoInsuficiente) as exc_info:
            obtener_usuario_actual(
                credenciales=credenciales, verificador=_VerificadorFalso(_USUARIO_SIN_ROLES)
            )

        assert exc_info.value.detalles["motivo"] == "sin_rol_asignado"


class TestExigirRoles:
    def test_con_el_rol_requerido_deja_pasar(self) -> None:
        dependencia = exigir_roles(Rol.GESTOR)

        assert dependencia(_USUARIO_GESTOR) is _USUARIO_GESTOR

    def test_con_alguno_de_varios_roles_requeridos_deja_pasar(self) -> None:
        dependencia = exigir_roles(Rol.ADMINISTRADOR, Rol.GESTOR)

        assert dependencia(_USUARIO_GESTOR) is _USUARIO_GESTOR

    def test_sin_el_rol_requerido_lanza_permiso_insuficiente(self) -> None:
        dependencia = exigir_roles(Rol.ADMINISTRADOR)

        with pytest.raises(PermisoInsuficiente) as exc_info:
            dependencia(_USUARIO_GESTOR)

        assert exc_info.value.detalles["roles_requeridos"] == ["administrador"]

    def test_usuario_sin_ningun_rol_lanza_permiso_insuficiente(self) -> None:
        dependencia = exigir_roles(Rol.VISITANTE)

        with pytest.raises(PermisoInsuficiente):
            dependencia(_USUARIO_SIN_ROLES)
