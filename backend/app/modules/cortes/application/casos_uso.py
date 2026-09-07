"""Casos de uso del módulo de cortes.

CAPA: Aplicación
TARJETAS: [HU-01][BE-03] CrearCorte
          [HU-01][BE-04] Regla de reutilización de fuentes entre cortes
          [HU-01][BE-05] Registro del corte y transición a REGISTRADO
          [HU-02][BE-04] CargarPlanIndicativo
          [HU-03][BE-06] CargarPresupuestal
          [HU-04][BE-04] CargarPlantillaBPIN

Orquesta dominio + repositorios + lectores y CONTROLA LA TRANSACCIÓN. No
importa FastAPI ni SQLAlchemy: recibe los puertos ya construidos desde
`core/dependencias.py` (inyección de dependencias).

=============================================================================
FRONTERAS DEL PIPELINE ETL — NO MEZCLARLAS
=============================================================================
    EXTRACT + TRANSFORM   el lector (estrategia por tipo), FUERA de la
                          transacción de escritura
    LOAD                  el repositorio, DENTRO de la transacción

Si la transformación falla, no se abrió ninguna transacción. Si el Load falla,
se revierte completo. En ningún caso quedan datos parciales — que es lo que
exige HU-02/CA-3.

=============================================================================
VALIDACIÓN DE ARCHIVOS: AQUÍ, NO EN LA API
=============================================================================
[SEC-03] dice: «La validación de archivos es una responsabilidad única en la
capa de Aplicación: no vive en la API, no se repite en cada caso de uso.»

Checklist de esa tarjeta:
  - Extensión declarada vs. MIME real del contenido
  - Tamaño máximo configurable, verificado ANTES de leer en memoria
  - Sanitización del nombre de archivo (path traversal)
  - Rechazo de libros con macros (.xlsm)
  - Verificación de que las hojas obligatorias existen antes de procesar
"""

from __future__ import annotations

from datetime import date

from app.modules.cortes.domain.puertos import RepositorioCortes, RepositorioDatosCorte


class ServicioCortes:
    def __init__(
        self,
        repo_cortes: RepositorioCortes,
        repo_datos: RepositorioDatosCorte,
        confirmar_transaccion,
        revertir_transaccion,
        hoy: date | None = None,
    ) -> None:
        self._cortes = repo_cortes
        self._datos = repo_datos
        self._commit = confirmar_transaccion
        self._rollback = revertir_transaccion
        self._hoy = hoy or date.today()

    def crear_corte(self, vigencia: int, fecha_corte: date):
        """HU-01 / CA-1, CA-2, CA-5, CA-7, CA-8."""
        raise NotImplementedError("[HU-01][BE-03]")

    def cargar_archivo(self, corte_id, tipo, contenido: bytes, nombre_archivo: str):
        """HU-02, HU-03, HU-04 y HU-06 (reemplazo del archivo)."""
        raise NotImplementedError("[HU-02][BE-04] / [HU-03][BE-06] / [HU-04][BE-04]")

    def registrar_corte(self, corte_id):
        """HU-01 / CA-3 y CA-4."""
        raise NotImplementedError("[HU-01][BE-05]")

    def listar_cortes(self):
        raise NotImplementedError("[HU-01][BE-03]")
