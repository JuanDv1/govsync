"""Entidades de dominio del módulo de identidad.

CAPA: Dominio
TARJETA: [HU-E01-01] Autenticación con Keycloak
CUBRE: E-01 (Gestión de Acceso y Roles) — ver docs/DECISIONES.md D23

=============================================================================
QUÉ MODELA
=============================================================================
Este archivo no sabe nada de Keycloak ni de JWT: eso es un detalle de la capa
de persistencia (el adaptador que valida el token contra el JWKS de Keycloak
y construye un Usuario a partir de sus claims). Aquí solo viven los dos
conceptos de los que depende cualquier chequeo de autorización:

- Rol: los tres roles acordados en D23 (administrador, gestor, visitante).
- Usuario: el principal autenticado — id estable (claim "sub"), correo y
  los roles que Keycloak le asignó.

=============================================================================
POR QUÉ "roles" ES UN frozenset Y NO UNA LISTA
=============================================================================
Usuario es inmutable (mismo patrón que CodigoIndicadorProducto en
app/shared/codigos.py), y nada en el modelo de Keycloak impide que una cuenta
tenga más de un rol asignado (p. ej. administrador + gestor). Un frozenset
evita depender de un orden que Keycloak no garantiza y hace que dos usuarios
con los mismos roles comparen igual.

=============================================================================
POR QUÉ UN Usuario SIN ROLES ES VÁLIDO (no lanza excepción)
=============================================================================
Una cuenta recién creada en Keycloak puede no tener ningún rol asignado
todavía. Rechazarla aquí mezclaría una regla de autorización HTTP (qué
responder cuando no hay rol) con el dominio. tiene_rol() simplemente devuelve
False para cualquier chequeo — es la capa de API/dependencias quien decide
si eso es un 403 o un acceso de solo lectura.

RESTRICCIÓN ARQUITECTÓNICA: sin imports de FastAPI, SQLAlchemy, Pydantic ni
JWT en este archivo. Lo verifica tests/test_arquitectura.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Rol(StrEnum):
    """Los tres roles de E-01 (D23, docs/DECISIONES.md)."""

    ADMINISTRADOR = "administrador"  # gestión completa
    GESTOR = "gestor"  # sube/corrige cortes y archivos
    VISITANTE = "visitante"  # solo lectura


@dataclass(frozen=True)
class Usuario:
    """Principal autenticado.

    Lo construye la capa de persistencia a partir de los claims del token de
    Keycloak ya validado — este tipo no valida nada, solo representa el
    resultado.
    """

    id: str
    correo: str
    roles: frozenset[Rol]

    def tiene_rol(self, *roles: Rol) -> bool:
        """True si el usuario tiene AL MENOS uno de los roles dados."""
        return bool(self.roles.intersection(roles))
