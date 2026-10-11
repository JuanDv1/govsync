"""Pruebas de las entidades de dominio del módulo de identidad.

TARJETA: [HU-E01-01] · CAPA: Dominio
CUBRE:
- tiene_rol con uno y con varios roles
- un Usuario sin roles es válido y no pasa ningún chequeo
- igualdad por valor (Usuario es un dataclass frozen)
"""

from __future__ import annotations

from app.modules.identidad.domain.entidades import Rol, Usuario


class TestUsuarioTieneRol:
    def test_tiene_rol_con_un_solo_rol_coincide(self) -> None:
        usuario = Usuario(id="abc", correo="a@a.com", roles=frozenset({Rol.GESTOR}))
        assert usuario.tiene_rol(Rol.GESTOR) is True

    def test_tiene_rol_con_un_solo_rol_no_coincide(self) -> None:
        usuario = Usuario(id="abc", correo="a@a.com", roles=frozenset({Rol.VISITANTE}))
        assert usuario.tiene_rol(Rol.ADMINISTRADOR) is False

    def test_tiene_rol_acepta_varios_candidatos_y_basta_con_uno(self) -> None:
        usuario = Usuario(id="abc", correo="a@a.com", roles=frozenset({Rol.GESTOR}))
        assert usuario.tiene_rol(Rol.ADMINISTRADOR, Rol.GESTOR) is True

    def test_usuario_con_varios_roles_propios(self) -> None:
        usuario = Usuario(
            id="abc", correo="a@a.com", roles=frozenset({Rol.ADMINISTRADOR, Rol.GESTOR})
        )
        assert usuario.tiene_rol(Rol.GESTOR) is True
        assert usuario.tiene_rol(Rol.VISITANTE) is False


class TestUsuarioSinRoles:
    def test_usuario_sin_roles_es_valido(self) -> None:
        usuario = Usuario(id="abc", correo="a@a.com", roles=frozenset())
        assert usuario.roles == frozenset()

    def test_usuario_sin_roles_no_pasa_ningun_chequeo(self) -> None:
        usuario = Usuario(id="abc", correo="a@a.com", roles=frozenset())
        assert usuario.tiene_rol(Rol.ADMINISTRADOR, Rol.GESTOR, Rol.VISITANTE) is False


class TestUsuarioIgualdad:
    def test_dos_usuarios_con_los_mismos_valores_son_iguales(self) -> None:
        a = Usuario(id="abc", correo="a@a.com", roles=frozenset({Rol.GESTOR}))
        b = Usuario(id="abc", correo="a@a.com", roles=frozenset({Rol.GESTOR}))
        assert a == b

    def test_usuarios_con_distinto_id_no_son_iguales(self) -> None:
        a = Usuario(id="abc", correo="a@a.com", roles=frozenset({Rol.GESTOR}))
        b = Usuario(id="xyz", correo="a@a.com", roles=frozenset({Rol.GESTOR}))
        assert a != b
