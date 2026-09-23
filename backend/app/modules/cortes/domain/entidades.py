"""Entidades y reglas de negocio del módulo de cortes.

CAPA: Dominio
TARJETA: [HU-01][BE-01] Entidad de dominio Corte con invariantes y estados
CUBRE: HU-01 / CA-2, CA-4

=============================================================================
INVARIANTES (de la tarjeta)
=============================================================================
- La vigencia no puede ser fecha futura (CA-2). Al violarse lanza excepción de
  dominio CON EL MOTIVO, no un error genérico.
- La vigencia debe ser un año dentro de un rango real (hallazgo del QA manual
  del 2026-09-23, ver D18 en docs/DECISIONES.md): sin esta regla, un valor
  como 0, negativo o un typo ("1" en vez de "2026") pasaba sin problema hasta
  la lectura del Excel, donde fallaba con un mensaje de "columnas faltantes"
  que no menciona la vigencia como causa real.
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

# from enum import Enum
from enum import StrEnum

from app.shared.codigos import CodigoIndicadorProducto, DescarteIndicador
from app.shared.errors import OperacionNoPermitida, ReglaDeNegocioViolada


class EstadoCorte(StrEnum):
    BORRADOR = "BORRADOR"
    REGISTRADO = "REGISTRADO"


class TipoArchivoFuente(StrEnum):
    PDT = "PDT"
    EJECUCION = "EJECUCION"
    PROYECTOS = "PROYECTOS"


#: Los tres archivos obligatorios de un corte (HU-01 / CA-3, CA-4).
ARCHIVOS_OBLIGATORIOS: tuple[TipoArchivoFuente, ...] = (
    TipoArchivoFuente.PDT,
    TipoArchivoFuente.EJECUCION,
    TipoArchivoFuente.PROYECTOS,
)

#: HU-01/CA-5, CA-7: archivos que se reutilizan automáticamente del último
#: corte REGISTRADO de la MISMA vigencia (D-05). EJECUCION queda deliberadamente
#: fuera de esta tupla: CA-7 exige que se solicite siempre, en todo corte.
#:
#: SUPUESTO (D-04 del equipo, PENDIENTE DE RATIFICAR CON LA CLIENTA): "el
#: archivo del municipio" de CA-5/CA-6 = la plantilla de proyectos BPIN, por
#: ser la única de las tres que el municipio diligencia a mano. Si en realidad
#: se refiere a un cuarto archivo no modelado, esta tupla y la tabla de fuentes
#: deben revisarse.
ARCHIVOS_REUTILIZABLES: tuple[TipoArchivoFuente, ...] = (
    TipoArchivoFuente.PDT,
    TipoArchivoFuente.PROYECTOS,
)

#: D18 (docs/DECISIONES.md, 2026-09-23): rango fijo y simple, sin acoplarse a
#: la fecha del sistema (alternativa elegida por el equipo entre las
#: presentadas). No pretende ser el año calendario real de la vigencia, solo
#: descartar valores sin sentido (0, negativos, typos de un solo dígito).
VIGENCIA_MINIMA = 2000
VIGENCIA_MAXIMA = 2100


@dataclass(slots=True)
class ArchivoFuente:
    tipo: TipoArchivoFuente
    nombre_archivo: str
    filas_reconocidas: int = 0
    reutilizado: bool = False
    corte_origen_id: uuid.UUID | None = None
    descartes: list[DescarteIndicador] = field(default_factory=list)
    """D14: propagados desde ResultadoLectura.descartes (contratos.py) por
    ServicioCortes._cargar_resultado. `[]` para archivos reutilizados
    (nunca se leyo nada) y para PDT/EJECUCION (no producen descartes de
    codigo hoy).
    """
    conteos: dict[str, int] = field(default_factory=dict)
    """[HU-03][FE-01]: propagado desde ResultadoLectura.conteos. `{}` para
    PDT/PROYECTOS (sus claves -- "metas"/"proyectos" -- nunca "ejecucion"/
    "contratacion", que es lo unico que pide el contrato). No menciona
    "archivos reutilizados" como razon aparte (a diferencia de
    `descartes`): CA-7 nunca permite reutilizar EJECUCION, asi que un
    archivo reutilizado siempre es PDT o PROYECTOS -- ya cubierto por la
    primera razon, no hay un caso adicional que reutilizacion agregue
    aqui.
    """
    codigos: list[CodigoIndicadorProducto] = field(default_factory=list)
    """[HU-04][FE-03]: propagados desde ResultadoLectura.codigos
    (contratos.py) por ServicioCortes._cargar_resultado -- ya vienen
    deduplicados por `.valor` desde el lector, este campo no vuelve a
    deduplicar. `[]` para archivos reutilizados y para PDT/EJECUCION
    (mismo criterio que `descartes`).
    """


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
        if fecha_corte > hoy:
            raise ReglaDeNegocioViolada(
                f"La fecha de corte ({fecha_corte.isoformat()}) no puede ser "
                f"posterior a hoy ({hoy.isoformat()}).",
                detalles={
                    "fecha_corte": fecha_corte.isoformat(),
                    "hoy": hoy.isoformat(),
                },
            )

    @staticmethod
    def validar_vigencia(vigencia: int) -> None:
        """D18 (docs/DECISIONES.md): rechaza una vigencia fuera de rango.

        Deliberadamente en el dominio y NO como `Field(ge=, le=)` en el
        esquema Pydantic de la API: un error de validación de Pydantic no
        pasa por `app/core/errores.py` (que solo traduce subclases de
        `GovSyncError`), así que el frontend (`api/cliente.js::ErrorApi`,
        que espera `{codigo, mensaje, detalles}`) recibiría un cuerpo con
        forma distinta (`{"detail": [...]}"`) y caería al mensaje genérico
        de fallback, perdiendo el detalle accionable. Levantar
        `ReglaDeNegocioViolada` aquí reutiliza el mismo mecanismo ya
        probado que `validar_fecha`.
        """
        if not (VIGENCIA_MINIMA <= vigencia <= VIGENCIA_MAXIMA):
            raise ReglaDeNegocioViolada(
                f"La vigencia ({vigencia}) debe estar entre {VIGENCIA_MINIMA} y {VIGENCIA_MAXIMA}.",
                detalles={
                    "motivo": "vigencia_fuera_de_rango",
                    "vigencia": vigencia,
                    "vigencia_minima": VIGENCIA_MINIMA,
                    "vigencia_maxima": VIGENCIA_MAXIMA,
                },
            )

    def archivos_faltantes(self) -> list[TipoArchivoFuente]:
        """Tipos obligatorios que aún no están cargados ni reutilizados."""
        return [tipo for tipo in ARCHIVOS_OBLIGATORIOS if tipo not in self.archivos]

    def esta_completo(self) -> bool:
        return not self.archivos_faltantes()

    def registrar(self) -> None:
        """HU-01/CA-3 y CA-4: transición BORRADOR -> REGISTRADO.

        Si falta algún archivo obligatorio, la operación se rechaza indicando
        CUÁL falta y el corte NO cambia de estado. Un mensaje genérico incumple
        el CA.

        Llamar sobre un corte ya REGISTRADO es idempotente: si sigue teniendo
        los 3 archivos (los tiene, si ya se registró antes) simplemente
        confirma el estado; la tarjeta no pide rechazar un doble registro.
        """
        faltantes = self.archivos_faltantes()
        if faltantes:
            raise OperacionNoPermitida(
                f"No se puede registrar el corte: faltan los archivos "
                f"{', '.join(tipo.value for tipo in faltantes)}.",
                detalles={"archivos_faltantes": [tipo.value for tipo in faltantes]},
            )
        self.estado = EstadoCorte.REGISTRADO

    def corregir(self, vigencia: int, fecha_corte: date, hoy: date) -> None:
        """D11 (docs/DECISIONES.md): corrige vigencia/fecha de un corte en
        BORRADOR, sin pasar por rechazar-y-crear-uno-nuevo.

        Un corte REGISTRADO no admite esta corrección: cambiar su vigencia
        rompería el histórico ya cerrado (aclaración de D11, 2026-09-19).
        """
        if self.estado != EstadoCorte.BORRADOR:
            raise OperacionNoPermitida(
                "Solo un corte en BORRADOR admite corrección de vigencia/fecha.",
                detalles={
                    "motivo": "corte_no_es_borrador",
                    "estado_actual": self.estado.value,
                },
            )
        Corte.validar_vigencia(vigencia)
        Corte.validar_fecha(fecha_corte, hoy)
        self.vigencia = vigencia
        self.fecha_corte = fecha_corte

    def puede_reutilizar(self, tipo: TipoArchivoFuente) -> bool:
        """HU-01/CA-5, CA-7: solo PDT y PROYECTOS son reutilizables.

        EJECUCION siempre devuelve False: CA-7 exige que se solicite en cada
        corte, sin excepción.
        """
        return tipo in ARCHIVOS_REUTILIZABLES
