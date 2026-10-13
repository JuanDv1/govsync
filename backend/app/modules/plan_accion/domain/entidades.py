"""Entidades y agregación de dominio del Plan de Acción Consolidado.

CAPA: Dominio
TARJETA: [E04-HU01] Consultar Plan de Acción Consolidado
CUBRE: HU01-CA02, CA03, CA05, CA08 (ver docs/DECISIONES.md D26)

=============================================================================
QUÉ RESUELVE ESTE ARCHIVO
=============================================================================
HU-07 (trazabilidad/persistence/consultas.py) ya resuelve el cruce de las
cuatro fuentes a nivel de FILA (meta×rubro×contrato), con fan-out explícito
cuando una meta tiene N rubros o N contratos -- correcto para esa HU, que
muestra el detalle sin resumir nada.

Esta HU pide lo contrario: UNA fila por meta (CA03), con totales correctos
(CA08) y un estado de cruce agregado (CA05). Sumar `presupuesto_apropiado`/
`ejecucion` fila a fila sobre el resultado de HU-07 DUPLICARÍA dinero: un
rubro vinculado a 3 contratos aparece en 3 filas con el MISMO monto (el
fan-out lo documenta trazabilidad/persistence/consultas.py). `agregar_por_
meta` existe exactamente para evitar ese error -- deduplica por RUBRO antes
de sumar, nunca suma filas crudas.

=============================================================================
DECISIÓN TÉCNICA D26 (docs/DECISIONES.md) -- PENDIENTE DE RATIFICAR
=============================================================================
El equipo autorizó avanzar con una propuesta razonable en vez de bloquear
el desarrollo, documentándola para que el PO/equipo la confirme o la
corrija (Decisiones #8 y #9 de `03_DECISIONES_SPRINT2.xlsx` siguen
`Abierta`). Dos decisiones viven aquí:

1. "Ejecución" (CA02) = OrdenPagoAcumulado, que `docs/DATOS.md` ya mapea a
   `RubroORM.obligacion_acumulada` (ver también el comentario de ese campo
   en `cortes/persistence/models.py`: "base del % de avance financiero").
   NO es Compromiso ni Pago -- evidencia: el semáforo real que Emilse ya
   usa con el alcalde compara OrdenPagoAcumulado contra
   ApropiacionDefinitiva (Reunión 5).
2. Estado de cruce por meta (CA05): se implementa EXACTAMENTE la
   definición que ya trae el propio CA05 del Excel ("Completo = la meta
   relacionó PDT, presupuesto y BPIN; Parcial = falta al menos una
   relación; Sin información = solo existe en el PDT") -- no se inventa
   una cuarta definición, solo se traduce a código la que el negocio ya
   escribió. Esto es un tercer vocabulario distinto del `estado_cruce` de
   5 valores de HU-07 (por FILA) a propósito: unificar ambos en uno solo
   no lo pidió ninguna CA todavía (Decisión #9 sigue abierta sobre ESO,
   no sobre esta definición en sí).

NO se decide aquí (sigue `[VALIDAR]`, fuera de esta HU):
- % Avance físico: SIEMPRE `None` -- depende de E-03 (`avance_fisico/`),
  que no tiene ningún código todavía (solo `.gitkeep`).
- Qué significan exactamente "Meta"/"Indicador"/"Producto" como 3 columnas
  separadas (CA02): el modelo de datos (`MetaORM`) solo distingue
  `cod_indicador_producto` (código) y `nombre_producto` (texto) -- no hay
  evidencia de 3 campos de texto distintos. Se expone `nombre_producto`
  una sola vez; inventar 3 valores de 1 campo real sería fabricar un
  requisito.

RESTRICCIÓN ARQUITECTÓNICA: sin imports de FastAPI, SQLAlchemy, Pandas ni
OpenPyXL en este archivo. Lo verifica tests/test_arquitectura.py.
"""

from __future__ import annotations

import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum


class EstadoCruceMeta(StrEnum):
    """CA05, por META (no confundir con `estado_cruce` de HU-07, por FILA)."""

    COMPLETO = "completo"
    PARCIAL = "parcial"
    SIN_INFORMACION = "sin_informacion"


@dataclass(frozen=True, slots=True)
class FilaFuenteMeta:
    """Una fila CRUDA del cruce meta×rubro×contrato -- la ENTRADA de
    `agregar_por_meta`. Misma granularidad (y mismo fan-out) que
    `trazabilidad.persistence.consultas.FilaMatriz`, más los campos que esa
    HU no necesitaba: `sector`/`meta_cuatrienio` (de la meta, no cambian
    entre filas de la misma meta) y `codigo_rubro`/`ejecucion` (del rubro,
    SE REPITEN si el mismo rubro aparece en varias filas por tener N
    contratos -- por eso `agregar_por_meta` deduplica por `codigo_rubro`
    antes de sumar, nunca por fila).
    """

    cod_indicador_producto: str
    nombre_producto: str | None
    sector: str | None
    meta_cuatrienio: Decimal | None
    cod_bpin: str | None
    codigo_rubro: str | None
    presupuesto_apropiado: Decimal | None
    ejecucion: Decimal | None
    numero_contrato: str | None


@dataclass(frozen=True, slots=True)
class FilaPlanAccion:
    """Una fila YA AGREGADA por meta -- la SALIDA de `agregar_por_meta`.
    `rubros`/`contratos` son tuplas de valores DISTINTOS (CA03: "sin
    duplicar los valores de la meta en los totales")."""

    cod_indicador_producto: str
    nombre_producto: str | None
    sector: str | None
    meta_programada: Decimal | None
    cod_bpin: str | None
    rubros: tuple[str, ...]
    presupuesto_definitivo: Decimal | None
    ejecucion: Decimal | None
    contratos: tuple[str, ...]
    avance_fisico_pct: None
    """Siempre `None`: depende de E-03 (avance físico), sin implementar
    todavía. Campo presente para que el contrato de la fila ya tenga el
    lugar reservado (CA02 lo pide como columna) sin fingir un dato que no
    existe."""
    avance_financiero_pct: Decimal | None
    estado_cruce: EstadoCruceMeta


@dataclass(frozen=True, slots=True)
class ResumenPlanAccion:
    """CA05, pie de la tabla: `total == completo + parcial + sin_informacion`
    siempre -- invariante verificada en `calcular_resumen`, no solo
    esperada."""

    total: int
    completo: int
    parcial: int
    sin_informacion: int


def agregar_por_meta(filas: list[FilaFuenteMeta]) -> list[FilaPlanAccion]:
    """CA02, CA03, CA05, CA08: agrupa filas crudas (1 por meta×rubro×
    contrato) en una fila por meta, sin duplicar dinero (CA03/CA08) y con
    el estado de cruce agregado (CA05).

    Deduplicación explícita por RUBRO antes de sumar (ver docstring del
    módulo): dos filas de la misma meta con el MISMO `codigo_rubro`
    aportan el mismo presupuesto/ejecución una sola vez, sin importar
    cuántos contratos distintos traiga ese rubro.
    """
    por_meta: dict[str, list[FilaFuenteMeta]] = defaultdict(list)
    for fila in filas:
        por_meta[fila.cod_indicador_producto].append(fila)

    resultado: list[FilaPlanAccion] = []
    for codigo, filas_meta in por_meta.items():
        primera = filas_meta[0]

        rubros_vistos: dict[str, FilaFuenteMeta] = {}
        for f in filas_meta:
            if f.codigo_rubro is not None and f.codigo_rubro not in rubros_vistos:
                rubros_vistos[f.codigo_rubro] = f

        contratos = tuple(
            sorted({f.numero_contrato for f in filas_meta if f.numero_contrato is not None})
        )

        presupuesto_definitivo = _sumar_opcional(
            f.presupuesto_apropiado for f in rubros_vistos.values()
        )
        ejecucion = _sumar_opcional(f.ejecucion for f in rubros_vistos.values())

        tiene_bpin = primera.cod_bpin is not None
        tiene_ejecucion = bool(rubros_vistos)
        tiene_contrato = bool(contratos)

        if tiene_bpin and tiene_ejecucion and tiene_contrato:
            estado = EstadoCruceMeta.COMPLETO
        elif not tiene_bpin and not tiene_ejecucion and not tiene_contrato:
            estado = EstadoCruceMeta.SIN_INFORMACION
        else:
            estado = EstadoCruceMeta.PARCIAL

        avance_financiero_pct = None
        if presupuesto_definitivo and presupuesto_definitivo > 0 and ejecucion is not None:
            avance_financiero_pct = (ejecucion / presupuesto_definitivo) * Decimal(100)

        resultado.append(
            FilaPlanAccion(
                cod_indicador_producto=codigo,
                nombre_producto=primera.nombre_producto,
                sector=primera.sector,
                meta_programada=primera.meta_cuatrienio,
                cod_bpin=primera.cod_bpin,
                rubros=tuple(sorted(rubros_vistos.keys())),
                presupuesto_definitivo=presupuesto_definitivo,
                ejecucion=ejecucion,
                contratos=contratos,
                avance_fisico_pct=None,
                avance_financiero_pct=avance_financiero_pct,
                estado_cruce=estado,
            )
        )

    return sorted(resultado, key=lambda f: f.cod_indicador_producto)


def _sumar_opcional(valores) -> Decimal | None:
    """SUM que distingue "no hay ningún valor" (None, CA-8 de HU-07: NULL
    explícito) de "la suma de los valores existentes es 0" -- igual que
    `presupuesto_apropiado` ya es `None` y no `Decimal(0)` cuando una meta
    no tiene rubro."""
    vistos = [v for v in valores if v is not None]
    if not vistos:
        return None
    total = Decimal(0)
    for v in vistos:
        total += v
    return total


@dataclass(frozen=True, slots=True)
class FiltrosPlanAccion:
    """[E04-HU02] Filtros del Plan de Acción -- CA01/CA02/CA03/CA04/CA05.

    Se aplican DESPUÉS de `agregar_por_meta`, sobre `list[FilaPlanAccion]`
    ya agregada, no sobre las filas crudas del cruce: los 3 criterios
    (sector, estado_cruce, busqueda) son propiedades de LA META ya
    consolidada (CA01 del Excel: "Panel de filtros... con el mismo
    comportamiento que los filtros de la matriz E-02 HU-10", pero el
    "mismo comportamiento" se refiere al resultado para el usuario -- AND
    entre criterios, OR dentro de uno mismo, CA05 -- no a filtrar al nivel
    SQL de HU-10). Filtrar aquí, en Python puro, en vez de reconstruir la
    consulta SQL para aceptar los mismos filtros, evita duplicar la lógica
    de `agregar_por_meta`/`estado_cruce` (que es Python, no SQL) en dos
    lugares, y el volumen esperado (~144 metas/corte, CA15 de HU-10) hace
    que filtrar en memoria sea tan barato como filtrar en la base de
    datos.

    `sector`/`estado_cruce`: listas -- CA05 "varios valores de un mismo
    criterio se combinan con OR"; `None` o lista vacía significa "sin
    filtro en ese criterio", igual que HU-10.

    `busqueda` (CA04): coincide contra `cod_indicador_producto` O
    `nombre_producto`, insensible a mayúsculas y tildes, desde 3
    caracteres -- la normalización de 3+ caracteres y "sin distinguir
    mayúsculas ni tildes" es responsabilidad de quien llama (frontend o
    el router); esta función SIEMPRE compara si `busqueda` no es None,
    sin reimponer el mínimo de 3 (eso es UX, no una regla de dominio).

    NO incluye un filtro de "Indicador" separado de "Meta": CA01 nombra
    "Sector, Indicador, Meta y Estado de cruce" como 4 entradas del panel,
    pero ningún CA (02-08) define un comportamiento propio para
    "Indicador" distinto de la búsqueda de "Meta" (CA04), y el modelo de
    datos no distingue "Indicador" de "Meta" como campos independientes
    (mismo punto ya señalado en D26 punto 5, docs/DECISIONES.md). SUPUESTO
    MENOR (no afecta esquema, seguridad ni dinero): se expone un único
    criterio de búsqueda de texto: si el equipo confirma que "Indicador"
    debe ser un filtro EXACTO distinto de la búsqueda libre de "Meta", se
    agrega un campo más aquí sin tocar los demás.
    """

    sector: tuple[str, ...] | None = None
    estado_cruce: tuple[EstadoCruceMeta, ...] | None = None
    busqueda: str | None = None


def _normalizar_texto(texto: str) -> str:
    """CA04: "sin distinguir mayúsculas ni tildes". `NFKD` separa cada
    letra acentuada en (letra base, marca diacrítica); descartar los
    caracteres `Mn` (marca, sin espacio) dentro de esa descomposición deja
    solo la letra base -- mismo truco que usan los lectores de Excel del
    proyecto para comparar encabezados sin depender de la codificación
    exacta del archivo de origen."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFKD", texto) if unicodedata.category(c) != "Mn"
    )
    return sin_tildes.casefold()


def filtrar_plan_accion(
    filas: list[FilaPlanAccion], filtros: FiltrosPlanAccion
) -> list[FilaPlanAccion]:
    """CA02, CA03, CA04, CA05: aplica los 3 criterios sobre filas YA
    agregadas por meta. CA06 (resumen recalculado) y CA07 (estado vacío)
    son responsabilidad de quien llama: pasar el resultado de esta función
    a `calcular_resumen` (CA06); una lista vacía ES el caso de CA07, sin
    necesidad de una rama especial aquí. CA08 (limpiar filtros) no es más
    que llamar con `FiltrosPlanAccion()` (los 3 campos en su default
    `None`) -- no se fabrica un modo "sin filtros" aparte."""
    resultado = filas

    if filtros.sector:
        sectores = set(filtros.sector)
        resultado = [f for f in resultado if f.sector in sectores]

    if filtros.estado_cruce:
        estados = set(filtros.estado_cruce)
        resultado = [f for f in resultado if f.estado_cruce in estados]

    if filtros.busqueda:
        patron = _normalizar_texto(filtros.busqueda)
        resultado = [
            f
            for f in resultado
            if patron in _normalizar_texto(f.cod_indicador_producto)
            or (f.nombre_producto is not None and patron in _normalizar_texto(f.nombre_producto))
        ]

    return resultado


def calcular_resumen(filas: list[FilaPlanAccion]) -> ResumenPlanAccion:
    """CA05: pie de la tabla. `total` es `len(filas)`, no una suma
    independiente -- así la invariante `total == completo+parcial+
    sin_informacion` no puede romperse por un error de conteo separado."""
    completo = sum(1 for f in filas if f.estado_cruce == EstadoCruceMeta.COMPLETO)
    sin_informacion = sum(1 for f in filas if f.estado_cruce == EstadoCruceMeta.SIN_INFORMACION)
    total = len(filas)
    parcial = total - completo - sin_informacion
    return ResumenPlanAccion(
        total=total, completo=completo, parcial=parcial, sin_informacion=sin_informacion
    )
