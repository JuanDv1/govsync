"""Dependencias FastAPI compartidas (composition root).

CAPA: API
TARJETAS: [HU-01][FE-01], [HU-02][FE-01], [HU-03][FE-01], [HU-04][FE-01]

Aquí se arma el grafo de objetos: cada caso de uso recibe sus repositorios ya
construidos y NO conoce SQLAlchemy.

-----------------------------------------------------------------------------
SOBRE AUTENTICACIÓN
-----------------------------------------------------------------------------
La tarjeta [REF-05] registra la decisión del equipo de diferir E-01
(autenticación y autorización) al Sprint 2, aceptando que las filas
Autenticación y Autorización de la Tabla 4 de la rúbrica queden en N/A, con la
mitigación de no exponer públicamente los endpoints de carga.

Este esqueleto RESPETA esa decisión: no hay dependencia de autorización.

Si el equipo revoca [REF-05], el cambio es acotado y entra aquí: una función
`exigir_roles(*roles)` que devuelva una dependencia, más un módulo
`modules/identidad/`. Los routers solo tendrían que añadir el parámetro.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_session

SesionDep = Annotated[Session, Depends(get_session)]

# TODO [HU-01][BE-03] Cuando exista ServicioCortes, agregar aquí su proveedor:
#
#   def obtener_servicio_cortes(sesion: SesionDep) -> ServicioCortes:
#       return ServicioCortes(
#           repo_cortes=RepositorioCortesSQL(sesion),
#           repo_datos=RepositorioDatosCorteSQL(sesion),
#           confirmar_transaccion=sesion.commit,
#           revertir_transaccion=sesion.rollback,
#       )
#
#   ServicioCortesDep = Annotated[ServicioCortes, Depends(obtener_servicio_cortes)]
