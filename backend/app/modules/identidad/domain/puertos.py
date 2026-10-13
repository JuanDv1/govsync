"""Puertos (interfaces) del módulo de identidad.

CAPA: Dominio
TARJETA: [HU-E01-01] Autenticación con Keycloak
CUBRE: E-01 (Gestión de Acceso y Roles) — ver docs/DECISIONES.md D23

El dominio define el contrato; `persistence/` lo implementa con la
validación real contra el JWKS de Keycloak (RS256). Los casos de uso y las
dependencias de FastAPI dependen de esta abstracción, nunca de la librería
de JWT concreta (Inversión de Dependencias) — mismo patrón que
`cortes/domain/puertos.py::RepositorioCortes`.

ESTE PUERTO SOLO AUTENTICA, NO AUTORIZA: convierte un token en un Usuario o
rechaza el token. Decidir si ESE Usuario tiene permiso para una acción es
responsabilidad de quien llama (`Usuario.tiene_rol()`, en `entidades.py`),
no de este contrato.

RESTRICCIÓN ARQUITECTÓNICA: sin imports de FastAPI, SQLAlchemy, Pydantic ni
JWT en este archivo. Lo verifica tests/test_arquitectura.py.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.modules.identidad.domain.entidades import Usuario


class VerificadorToken(ABC):
    @abstractmethod
    def verificar(self, token: str) -> Usuario:
        """Valida un token de Keycloak y devuelve el Usuario que representa.

        `token` es el JWT ya extraído, sin el prefijo "Bearer " (ese parsing
        es HTTP, le corresponde a `core/dependencias.py`).

        Lanza `CredencialesInvalidas` (app/shared/errors.py, ya mapeada a
        401 en core/errores.py) si el token está ausente, mal formado,
        expirado, o su firma no valida contra el JWKS de Keycloak.
        """
