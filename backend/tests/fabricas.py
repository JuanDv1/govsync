"""Generadores de libros de Excel para las pruebas.

TARJETA: [DEV-05] · usado por las pruebas de [HU-02], [HU-03], [HU-04]

Se construyen EN MEMORIA en vez de versionar archivos binarios: el contenido de
cada caso queda explícito y revisable en el diff, y una variante (falta una
columna, falta una pestaña) se declara aquí en vez de adjuntar otro .xlsx opaco.

Los datos deben reproducir las peculiaridades reales de los archivos de Santa
Rosa (ver docs/DATOS.md):

  - el PDT trae una fila de títulos de sección encima del encabezado;
  - la pestaña de ejecución se llama 'Formato Resumido Ejecucion Gast';
  - hay códigos de indicador que empiezan en cero;
  - la plantilla de proyectos usa celdas verticalmente combinadas y mete
    varios indicadores en una celda separados por saltos de línea;
  - un contrato tiene varios registros presupuestales;
  - hay filas de subtotal con UltimoNivel = False.

Un fixture que no reproduzca estas rarezas deja pasar defectos que sí aparecen
con el archivo real.
"""

from __future__ import annotations

import io

from openpyxl import Workbook

# Códigos usados de forma consistente en las tres fuentes, para que el cruce de
# la matriz sea verificable de punta a punta.
COD_A = "170202300"
COD_B = "040110500"  # empieza en cero: el caso que rompe un dtype numérico
COD_C = "330105300"
BPIN_1 = "202500000050132"
BPIN_2 = "202500000050299"


def _a_bytes(libro: Workbook) -> bytes:
    buffer = io.BytesIO()
    libro.save(buffer)
    return buffer.getvalue()


def construir_pdt(*, incluir_principal: bool = True) -> bytes:
    """PDT válido, o una variante sin una columna obligatoria (HU-02/CA-3)."""
    raise NotImplementedError("[HU-02] fixture")


def construir_ejecucion(
    *, incluir_ejecucion: bool = True, incluir_contratacion: bool = True
) -> bytes:
    """Archivo presupuestal válido, o sin alguna pestaña (HU-03/CA-4)."""
    raise NotImplementedError("[HU-03] fixture")


def construir_proyectos(*, incluir_bpin: bool = True) -> bytes:
    """Plantilla con celdas combinadas y un indicador multivalor (HU-04/CA-4)."""
    raise NotImplementedError("[HU-04] fixture")
