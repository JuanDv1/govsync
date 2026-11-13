"""Registros que no pudieron relacionarse en el cruce de fuentes.

CAPA: Dominio
TARJETA: [E-04/HU-05] BE - Visualizar registros no relacionados (alertas de
cruce). CUBRE: HU05-CA02 (forma de la fila), CA03 (catálogo cerrado de
motivos), CA04 (filtros), CA05 (total = suma por fuente), CA06 (lista
vacía, sin rama especial).

Fuente: hoja HU_E04_05 del levantamiento v3.0 + decisiones del refinamiento
del 2026-11-11 (tarjeta BE). El catálogo de nueve motivos es CERRADO: no
hay motivo "otro". Los puntos marcados (R) en la tarjeta (quitar "Rubro sin
BPIN", incluir "BPIN del contrato no existe en la plantilla BPIN" y no
contar lo excluido a propósito por las reglas 1b/1c) están pendientes de
ratificar con la clienta; si cambian, se cambia este catálogo y las
consultas de `persistence/consultas.py`, nada más.

Este módulo no sabe de SQL: recibe los registros ya detectados y solo
filtra, cuenta, ordena y pagina.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum

#: Tope de `tamano_pagina` (lo valida la API): evita que un cliente pida
#: todo el corte en una sola página.
TAMANO_PAGINA_MAXIMO = 200


class Fuente(StrEnum):
    """CA02: la fuente del registro, en el orden en que se muestran."""

    PLAN_INDICATIVO = "PLAN_INDICATIVO"
    PRESUPUESTAL = "PRESUPUESTAL"
    BPIN = "BPIN"


class Motivo(StrEnum):
    """CA03: catálogo cerrado (refinamiento del 2026-11-11). El orden de
    declaración es el orden en que se listan dentro de cada fuente."""

    META_SIN_PROYECTO = "meta_sin_proyecto"
    META_SIN_EJECUCION = "meta_sin_ejecucion"
    META_SIN_CONTRATO = "meta_sin_contrato"
    RUBRO_INDICADOR_NO_EXISTE_EN_PDT = "rubro_indicador_no_existe_en_pdt"
    RUBRO_SIN_INDICADOR = "rubro_sin_indicador"
    REGISTRO_RUBRO_NO_EXISTE = "registro_rubro_no_existe"
    CONTRATO_BPIN_NO_EXISTE_EN_PLANTILLA = "contrato_bpin_no_existe_en_plantilla"
    PROYECTO_INDICADOR_NO_EXISTE_EN_PDT = "proyecto_indicador_no_existe_en_pdt"
    PROYECTO_SIN_INDICADOR = "proyecto_sin_indicador"


ETIQUETAS_FUENTE: dict[Fuente, str] = {
    Fuente.PLAN_INDICATIVO: "Plan Indicativo",
    Fuente.PRESUPUESTAL: "Presupuestal",
    Fuente.BPIN: "BPIN",
}

#: Etiqueta de cada motivo, tal cual la tabla del refinamiento.
ETIQUETAS_MOTIVO: dict[Motivo, str] = {
    Motivo.META_SIN_PROYECTO: "Meta sin proyecto BPIN",
    Motivo.META_SIN_EJECUCION: "Meta sin ejecución presupuestal",
    Motivo.META_SIN_CONTRATO: "Meta sin contrato",
    Motivo.RUBRO_INDICADOR_NO_EXISTE_EN_PDT: "Indicador del rubro no existe en el Plan Indicativo",
    Motivo.RUBRO_SIN_INDICADOR: "Rubro sin código de indicador",
    Motivo.REGISTRO_RUBRO_NO_EXISTE: "Rubro del registro presupuestal no existe en la ejecución",
    Motivo.CONTRATO_BPIN_NO_EXISTE_EN_PLANTILLA: "BPIN del contrato no existe en la plantilla BPIN",
    Motivo.PROYECTO_INDICADOR_NO_EXISTE_EN_PDT: (
        "Indicador del proyecto no existe en el Plan Indicativo"
    ),
    Motivo.PROYECTO_SIN_INDICADOR: "Proyecto sin indicador reconocible",
}

#: Cada motivo pertenece a una sola fuente: la fuente de una fila se deduce
#: del motivo y no puede contradecirlo.
FUENTE_DEL_MOTIVO: dict[Motivo, Fuente] = {
    Motivo.META_SIN_PROYECTO: Fuente.PLAN_INDICATIVO,
    Motivo.META_SIN_EJECUCION: Fuente.PLAN_INDICATIVO,
    Motivo.META_SIN_CONTRATO: Fuente.PLAN_INDICATIVO,
    Motivo.RUBRO_INDICADOR_NO_EXISTE_EN_PDT: Fuente.PRESUPUESTAL,
    Motivo.RUBRO_SIN_INDICADOR: Fuente.PRESUPUESTAL,
    Motivo.REGISTRO_RUBRO_NO_EXISTE: Fuente.PRESUPUESTAL,
    Motivo.CONTRATO_BPIN_NO_EXISTE_EN_PLANTILLA: Fuente.PRESUPUESTAL,
    Motivo.PROYECTO_INDICADOR_NO_EXISTE_EN_PDT: Fuente.BPIN,
    Motivo.PROYECTO_SIN_INDICADOR: Fuente.BPIN,
}

_ORDEN_FUENTE = {fuente: i for i, fuente in enumerate(Fuente)}
_ORDEN_MOTIVO = {motivo: i for i, motivo in enumerate(Motivo)}


@dataclass(frozen=True, slots=True)
class RegistroNoRelacionado:
    """CA02: una fila por (registro, motivo). Una meta sin BPIN y sin
    ejecución aparece dos veces, una por motivo (decisión 2 del
    refinamiento)."""

    motivo: Motivo
    codigo: str | None
    """Siempre texto: los códigos conservan sus ceros a la izquierda."""
    descripcion: str | None
    valor: Decimal | None
    """Decisión 7 del refinamiento: rubro -> apropiación definitiva;
    contrato -> valor del contrato; meta y proyecto -> vacío (`None`,
    nunca 0)."""

    @property
    def fuente(self) -> Fuente:
        return FUENTE_DEL_MOTIVO[self.motivo]


def clave_bpin(bpin: str) -> str:
    """Clave para decidir si dos BPIN son el mismo proyecto: año (4
    dígitos) + consecutivo sin ceros de relleno.

    DECISIÓN TÉCNICA (2026-11-12, pendiente de ratificar junto con el motivo
    `contrato_bpin_no_existe_en_plantilla`, punto (R) del refinamiento): con
    los archivos reales de la clienta, la plantilla trae BPIN de 15 dígitos y
    la ejecución los escribe con 14 o 16 (`20260000006448` frente a
    `202600000006448`). Compararlos letra por letra reportaba como
    "inexistentes" 10 de 17 contratos que sí estaban en la plantilla. Un
    BPIN que no es todo dígitos se compara tal cual (sin espacios).
    """
    limpio = bpin.strip()
    if len(limpio) > 4 and limpio.isdigit():
        return f"{limpio[:4]}-{int(limpio[4:])}"
    return limpio


@dataclass(frozen=True, slots=True)
class FiltrosNoRelacionados:
    """CA04: listas; OR dentro del mismo criterio y AND entre criterios
    (mismo comportamiento que los filtros de HU-10). `None` o vacío = sin
    filtro en ese criterio."""

    fuentes: tuple[Fuente, ...] | None = None
    motivos: tuple[Motivo, ...] | None = None


@dataclass(frozen=True, slots=True)
class ResultadoNoRelacionados:
    """CA05: `total == sum(conteos_por_fuente.values())` siempre, y ambos
    se calculan sobre las filas YA filtradas, antes de paginar: son los
    mismos números que tendría el Excel exportado con esos filtros."""

    filas: tuple[RegistroNoRelacionado, ...]
    """Solo la página pedida."""
    total: int
    conteos_por_fuente: dict[Fuente, int]
    pagina: int
    tamano_pagina: int


def ordenar(registros: list[RegistroNoRelacionado]) -> list[RegistroNoRelacionado]:
    """Orden estable: fuente, motivo (orden del catálogo) y código. Así la
    misma consulta da siempre la misma página."""
    return sorted(
        registros,
        key=lambda r: (
            _ORDEN_FUENTE[r.fuente],
            _ORDEN_MOTIVO[r.motivo],
            r.codigo or "",
            r.descripcion or "",
        ),
    )


def filtrar(
    registros: list[RegistroNoRelacionado], filtros: FiltrosNoRelacionados
) -> list[RegistroNoRelacionado]:
    """CA04. Una lista vacía como resultado es el CA06 (o un filtro sin
    coincidencias): no hay rama especial."""
    resultado = registros
    if filtros.fuentes:
        fuentes = set(filtros.fuentes)
        resultado = [r for r in resultado if r.fuente in fuentes]
    if filtros.motivos:
        motivos = set(filtros.motivos)
        resultado = [r for r in resultado if r.motivo in motivos]
    return resultado


def contar_por_fuente(registros: list[RegistroNoRelacionado]) -> dict[Fuente, int]:
    """CA05: las tres fuentes siempre presentes (0 si no hay filas), para
    que el frontend no tenga que completar claves faltantes."""
    conteo = Counter(r.fuente for r in registros)
    return {fuente: conteo.get(fuente, 0) for fuente in Fuente}


def consultar(
    registros: list[RegistroNoRelacionado],
    filtros: FiltrosNoRelacionados,
    pagina: int,
    tamano_pagina: int,
) -> ResultadoNoRelacionados:
    """Filtrar -> ordenar -> contar -> paginar. Los filtros se aplican
    ANTES de paginar y de contar (tarjeta: "aplicados antes de paginar")."""
    filtrados = ordenar(filtrar(registros, filtros))
    inicio = (pagina - 1) * tamano_pagina
    return ResultadoNoRelacionados(
        filas=tuple(filtrados[inicio : inicio + tamano_pagina]),
        total=len(filtrados),
        conteos_por_fuente=contar_por_fuente(filtrados),
        pagina=pagina,
        tamano_pagina=tamano_pagina,
    )
