"""Endpoints de cortes y carga de archivos fuente.

CAPA: API
TARJETAS: [HU-01][FE-01] Endpoints de corte
          [HU-02][FE-01] Endpoint de carga del Plan Indicativo
          [HU-03][FE-01] Endpoint de carga del archivo presupuestal
          [HU-04][FE-01] Endpoint de carga de la plantilla BPIN

Solo HTTP: validación superficial, conversión a DTO y códigos de estado.
NINGUNA regla de negocio ni consulta vive aquí.

Los DTO son modelos Pydantic, NUNCA entidades ORM: si se expusiera el ORM,
agregar una columna cambiaría el contrato de la API en silencio.

Al terminar, registrar el router en app/main.py.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/cortes", tags=["Cortes de seguimiento"])

# TODO [HU-01][FE-01]
#   POST   /cortes                          crear corte (201)
#   GET    /cortes                          histórico (CA-4)
#   GET    /cortes/{id}                     detalle
#   POST   /cortes/{id}/archivos/{tipo}     cargar/reemplazar archivo
#   POST   /cortes/{id}/registrar           transición a REGISTRADO
#
# Códigos de estado esperados:
#   201 creado · 200 ok · 404 no existe · 409 estado inválido
#   422 regla de negocio violada o archivo inválido
# El mapeo excepción -> HTTP ya está centralizado en app/core/errores.py.
