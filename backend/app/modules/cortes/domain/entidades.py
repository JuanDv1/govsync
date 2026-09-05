"""Entidades y reglas de negocio del módulo de cortes.

CAPA: Dominio
TARJETA: [HU-01][BE-01] Entidad de dominio Corte con invariantes y estados
CUBRE: HU-01 / CA-2, CA-4

=============================================================================
INVARIANTES (de la tarjeta)
=============================================================================
- La vigencia no puede ser fecha futura (CA-2). Al violarse lanza excepción de
  dominio CON EL MOTIVO, no un error genérico.
- El paso a REGISTRADO exige las tres fuentes asociadas (CA-4).
- Un corte REGISTRADO no admite cambio de vigencia.

=============================================================================
POR QUÉ EL CORTE TIENE ESTADO
=============================================================================
HU-01/CA-3 exige que un corte incompleto NO quede registrado, pero
HU-02/CA-1, HU-03/CA-1 y HU-04/CA-1 exigen subir archivos contra un corte que
ya existe. Sin un estado explícito ambas cosas son incompatibles: los archivos
se cargan contra un corte en BORRADOR y solo al completarse pasa a REGISTRADO
y entra al histórico.

RESTRICCIÓN ARQUITECTÓNICA: sin imports de SQLAlchemy, FastAPI, pandas ni
openpyxl. Lo verifica tests/test_arquitectura.py.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class EstadoCorte(str, Enum):
    BORRADOR = "BORRADOR"
    REGISTRADO = "REGISTRADO"


class TipoArchivoFuente(str, Enum):
    PDT = "PDT"
    EJECUCION = "EJECUCION"
    PROYECTOS = "PROYECTOS"


#: Los tres archivos obligatorios de un corte (HU-01 / CA-3, CA-4).
ARCHIVOS_OBLIGATORIOS: tuple[TipoArchivoFuente, ...] = (
    TipoArchivoFuente.PDT,
    TipoArchivoFuente.EJECUCION,
    TipoArchivoFuente.PROYECTOS,
)

# TODO [HU-01][BE-04] Declarar qué archivos son reutilizables.
#   HU-01/CA-5: "el PDT y el archivo del municipio" se reutilizan del corte
#   anterior. HU-01/CA-7: el archivo de ejecución NUNCA se reutiliza.
#   PENDIENTE DE CONFIRMAR CON LA CLIENTA: se interpretó que "archivo del
#   municipio" = la plantilla de proyectos BPIN, por ser la única de las tres
#   que el municipio diligencia a mano. Si es un cuarto archivo, falta una tabla.


@dataclass(slots=True)
class ArchivoFuente:
    tipo: TipoArchivoFuente
    nombre_archivo: str
    filas_reconocidas: int = 0
    reutilizado: bool = False
    corte_origen_id: uuid.UUID | None = None


@dataclass(slots=True)
class Corte:
    """Agrupación de fuentes y resultados de un momento de seguimiento."""

    vigencia: int
    fecha_corte: date
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    estado: EstadoCorte = EstadoCorte.BORRADOR
    archivos: dict[TipoArchivoFuente, ArchivoFuente] = field(default_factory=dict)

    @staticmethod
    def validar_fecha(fecha_corte: date, hoy: date) -> None:
        """HU-01/CA-2: no se aceptan cortes con fecha futura."""
        raise NotImplementedError("[HU-01][BE-01] Invariante de fecha no futura")

    def archivos_faltantes(self) -> list[TipoArchivoFuente]:
        """Tipos obligatorios que aún no están cargados ni reutilizados."""
        raise NotImplementedError("[HU-01][BE-01] Regla de completitud")

    def esta_completo(self) -> bool:
        raise NotImplementedError("[HU-01][BE-01] Regla de completitud")

    def registrar(self) -> None:
        """HU-01/CA-3 y CA-4: transición BORRADOR -> REGISTRADO.

        Si falta algún archivo obligatorio, la operación se rechaza indicando
        CUÁL falta y el corte NO cambia de estado. Un mensaje genérico incumple
        el CA.
        """
        raise NotImplementedError("[HU-01][BE-05] Transición a REGISTRADO")

    def puede_reutilizar(self, tipo: TipoArchivoFuente) -> bool:
        """HU-01/CA-7: el archivo de ejecución nunca se reutiliza."""
        raise NotImplementedError("[HU-01][BE-04] Regla de reutilización")

import sqlalchemy
