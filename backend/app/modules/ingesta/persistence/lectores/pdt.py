"""Lector del Plan Indicativo (PDT) exportado de SisPT.

CAPA: Persistencia
TARJETAS: [HU-02][BE-01] localización de pestaña
          [HU-02][BE-02] validación de columnas mínimas
          [HU-02][BE-03] detección de archivo que no corresponde
CUBRE: HU-02 / CA-2, CA-3, CA-4, CA-6

=============================================================================
ANATOMÍA DEL ARCHIVO REAL (ver docs/DATOS.md)
=============================================================================
6 pestañas. SOLO 'Plan indicativo - Productos' contiene metas (CA-2). Las otras
cinco ('Líneas estratégicas', 'Indicadores de resultado', 'Plan indicativo SGR
- Productos', 'Iniciativas SGR', 'Iniciativas PATR') NO se interpretan.

Encabezado en la FILA 2. 86 columnas, 144 filas de metas.

Columnas que importan:
  - 'Código de indicador de producto (MGA)'   <- LA LLAVE (9 dígitos)
  - 'Producto (MGA)', 'Indicador de Producto(MGA)'
  - 'Principal'                                <- Sí=135 / No=9
  - 'Programación del producto bien o servicio <año>'
  - 'Total <año>'

'Código de indicador de producto (SisPT)' contiene 'IP-63' y NO es la llave.

=============================================================================
CRITERIOS
=============================================================================
CA-2: reconocer específicamente la pestaña de productos.
CA-3: verificar columnas mínimas (código de indicador, meta programada por
      vigencia, marca "Principal"). Si falta alguna -> rechazo TOTAL indicando
      cuál.
CA-4: si el archivo no es un PDT (p. ej. suben el de ejecución), rechazar
      indicándolo, SIN intentar adivinar el contenido.
CA-6: aporta a la matriz el código de indicador y el nombre del producto.
"""

from __future__ import annotations

from app.modules.ingesta.domain.contratos import (
    LectorArchivoFuente,
    ResultadoLectura,
    TipoArchivo,
)

ALIAS_HOJA = ("Plan indicativo - Productos", "Plan indicativo Productos")

# TODO [HU-02][BE-02] Declarar aquí las columnas obligatorias con sus alias.
OBLIGATORIAS: dict[str, tuple[str, ...]] = {}


class LectorPDT(LectorArchivoFuente):
    tipo = TipoArchivo.PDT

    def leer(self, contenido: bytes, nombre_archivo: str) -> ResultadoLectura:
        raise NotImplementedError("[HU-02][BE-01]")
