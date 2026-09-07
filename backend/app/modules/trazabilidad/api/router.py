"""Endpoint de la matriz de relación.

CAPA: API
TARJETA: [HU-07][FE-01] Endpoint de la matriz con paginación

Sugerencia de diseño: enviar las COLUMNAS junto con los datos, para que el
contrato de las seis columnas confirmadas viva en un solo lugar y el frontend
no pueda desalinearse de él en silencio.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/matriz-relacion", tags=["Trazabilidad"])

#: Las seis columnas confirmadas (HU-07 / CA-3 a CA-6).
COLUMNAS: list[dict[str, str]] = [
    {"clave": "cod_bpin", "titulo": "Cód. BPIN", "fuente": "Proyectos"},
    {"clave": "cod_indicador_producto", "titulo": "Cód. indicador (SisPT)", "fuente": "PDT"},
    {"clave": "nombre_producto", "titulo": "Nombre del producto", "fuente": "PDT"},
    {
        "clave": "cod_indicador_ejecucion",
        "titulo": "Cód. indicador (ejecución)",
        "fuente": "Ejecución",
    },
    {"clave": "numero_contrato", "titulo": "Núm. contrato", "fuente": "Contratación"},
    {"clave": "descripcion_contrato", "titulo": "Descripción", "fuente": "Contratación"},
]

# TODO [HU-07][FE-01]
#   GET /matriz-relacion/actual?pagina=&tamano_pagina=
#   GET /matriz-relacion/{corte_id}?pagina=&tamano_pagina=
