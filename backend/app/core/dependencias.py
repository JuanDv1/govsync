"""Dependencias FastAPI compartidas (composition root).

CAPA: API
TARJETAS: [HU-01][FE-01], [HU-02][FE-01], [HU-03][FE-01], [HU-04][FE-01],
[HU-E01-01] (autenticación/autorización, ver docs/DECISIONES.md D23)

Aquí se arma el grafo de objetos: cada caso de uso recibe sus repositorios ya
construidos y NO conoce SQLAlchemy.

-----------------------------------------------------------------------------
SOBRE AUTENTICACIÓN
-----------------------------------------------------------------------------
[REF-05] diferió E-01 al Sprint 2; D23 (docs/DECISIONES.md) la retoma con
Keycloak. `obtener_usuario_actual`/`UsuarioActualDep` resuelven QUIÉN hace la
petición (autenticación); `exigir_roles(*roles)` resuelve si ese usuario
puede hacer ESTA acción (autorización) — los routers que necesiten
protegerse agregan `Depends(exigir_roles(...))`, ningún router existente se
modifica en esta tarjeta.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_session
from app.modules.cortes.application.casos_uso import ServicioCortes
from app.modules.cortes.domain.entidades import TipoArchivoFuente
from app.modules.cortes.persistence.repositorios import (
    RepositorioCortesSQL,
    RepositorioDatosCorteSQL,
)
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.modules.identidad.domain.puertos import VerificadorToken
from app.modules.identidad.persistence.keycloak import VerificadorTokenKeycloak
from app.modules.ingesta.persistence.lectores.ejecucion import LectorEjecucion
from app.modules.ingesta.persistence.lectores.pdt import LectorPDT
from app.modules.ingesta.persistence.lectores.proyectos import LectorProyectos
from app.shared.errors import CredencialesInvalidas, PermisoInsuficiente

SesionDep = Annotated[Session, Depends(get_session)]

# auto_error=False: si el header Authorization falta, HTTPBearer por defecto
# respondería con el {"detail": ...} nativo de FastAPI, no con el sobre
# {codigo, mensaje, detalles} que espera api/cliente.js (mismo problema que
# D18 ya documentó para los errores de validación de Pydantic). Se captura
# la ausencia manualmente abajo y se lanza CredencialesInvalidas.
_esquema_bearer = HTTPBearer(auto_error=False)


@lru_cache
def obtener_verificador_token() -> VerificadorToken:
    """Composition root del verificador de Keycloak.

    @lru_cache (mismo patrón que get_settings()): sin esto, cada request
    construiría un VerificadorTokenKeycloak nuevo con su propio PyJWKClient,
    y el caché de 5 minutos de las llaves públicas nunca se reutilizaría
    entre requests — se golpearía Keycloak en cada petición.
    """
    ajustes = get_settings()
    return VerificadorTokenKeycloak(
        issuer=ajustes.keycloak_issuer, audience=ajustes.keycloak_audience
    )


def obtener_usuario_actual(
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_esquema_bearer)],
    verificador: Annotated[VerificadorToken, Depends(obtener_verificador_token)],
) -> Usuario:
    if credenciales is None:
        raise CredencialesInvalidas("Falta el encabezado Authorization con el token.")
    return verificador.verificar(credenciales.credentials)


UsuarioActualDep = Annotated[Usuario, Depends(obtener_usuario_actual)]


def exigir_roles(*roles: Rol):
    """Dependencia de autorización: exige que el usuario autenticado tenga
    AL MENOS uno de `roles`. Lanza PermisoInsuficiente (403) si no.

    Uso en un router: `usuario: Annotated[Usuario, Depends(exigir_roles(Rol.ADMINISTRADOR))]`.
    """

    def _dependencia(usuario: UsuarioActualDep) -> Usuario:
        if not usuario.tiene_rol(*roles):
            raise PermisoInsuficiente(
                "Tu rol no tiene permiso para esta acción.",
                detalles={"roles_requeridos": [rol.value for rol in roles]},
            )
        return usuario

    return _dependencia


#: [HU-02][BE-04]/[HU-03][BE-06]/[HU-04][BE-04]: registro de lectores
#: disponibles (Strategy). Las tres fuentes (PDT, EJECUCION, PROYECTOS)
#: tienen lector + carga (`reemplazar_*`) funcionales — ver el docstring de
#: `_cargar_resultado` (casos_uso.py) para el despacho por tipo.
_LECTORES_DISPONIBLES = {
    TipoArchivoFuente.PDT: LectorPDT(),
    TipoArchivoFuente.EJECUCION: LectorEjecucion(),
    TipoArchivoFuente.PROYECTOS: LectorProyectos(),
}


def obtener_servicio_cortes(sesion: SesionDep) -> ServicioCortes:
    """[HU-01][FE-01] Composition root de ServicioCortes para los routers.

    OJO [BD-02]: RepositorioCortesSQL y RepositorioDatosCorteSQL siguen
    siendo clases abstractas incompletas en develop (solo TODO, sin
    metodos implementados) — instanciarlas aqui lanza TypeError. Contra
    Postgres real, los endpoints que dependen de esto responderan 500 hasta
    que [BD-02] se fusione (existe en origin/base/modelos). Las pruebas de
    la API no pasan por aqui: sobreescriben ServicioCortesDep con
    repositorios en memoria (ver tests/test_router_cortes.py).
    """
    return ServicioCortes(
        repo_cortes=RepositorioCortesSQL(sesion),
        repo_datos=RepositorioDatosCorteSQL(sesion),
        confirmar_transaccion=sesion.commit,
        revertir_transaccion=sesion.rollback,
        lectores=_LECTORES_DISPONIBLES,
    )


ServicioCortesDep = Annotated[ServicioCortes, Depends(obtener_servicio_cortes)]
