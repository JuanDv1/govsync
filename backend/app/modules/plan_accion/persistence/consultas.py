"""Consulta SQL del Plan de Acción Consolidado (datos crudos, sin agregar).

CAPA: Persistencia
TARJETA: [E04-HU01] Consultar Plan de Acción Consolidado
CUBRE: HU01-CA01, CA02, CA06, CA09 (carga de datos). La AGREGACIÓN por meta
(CA03, CA05, CA08) es responsabilidad de `domain.entidades.agregar_por_meta`
-- este archivo solo extrae, no suma ni agrupa (separación ETL: Extract acá,
Transform en dominio).

=============================================================================
POR QUÉ YA NO HAY DOS CONSULTAS DUPLICADAS (actualizado 2026-10-29)
=============================================================================
Hasta el refactor de Sprint 3, este archivo y
`trazabilidad/persistence/consultas.py` construían el MISMO cruce de 4
fuentes (mismas 3 reglas invioables: ultimo_nivel, LEFT JOIN, puente
deduplicado) con dos bloques de código copiados -- la razón documentada
entonces era que cada HU proyecta columnas distintas sobre ese cruce
(`sector`/`meta_cuatrienio`/`codigo_rubro`/`obligacion_acumulada` acá;
`descripcion_contrato`/`nombre_proyecto` en HU-07) y el equipo decidió no
acoplar un módulo a otro para resolverlo.

Esa razón sigue siendo válida -- lo que cambió es que la parte 100%
idéntica entre ambos (las dos subconsultas-puente y la cadena de 4 LEFT
JOIN) se extrajo a `app/shared/persistence/cruce_fuentes.py`
(`construir_cruce_fuentes`), código explícitamente compartido que NO
pertenece a ningún módulo. Cada módulo sigue eligiendo sus propias columnas
(se le pasa una función que las construye) y ninguno importa del otro --
ver el docstring de `cruce_fuentes.py` para el detalle completo y por qué
esa ubicación no infringe las reglas de `tests/test_arquitectura.py`.

Ya NO hay dos copias de las 3 reglas del JOIN: viven una sola vez en
`cruce_fuentes.py` (leer ese docstring para el detalle de cada regla).

=============================================================================
QUÉ CAMBIA RESPECTO A LA CONSULTA DE HU-07
=============================================================================
1. Llave de rubro: se expone `RubroORM.codigo_rubro_nivel` ("Decisión 3: llave
   real del rubro. NO codigo_rubro_ccpet -- 142 duplicados", ver
   `cortes/persistence/models.py`), no `cod_indicador_producto`. Es la que
   usa `agregar_por_meta` para deduplicar por rubro antes de sumar dinero
   (ver docstring de `domain/entidades.py`).
2. "Ejecución" = `RubroORM.obligacion_acumulada` (D26, docs/DECISIONES.md),
   NO `apropiacion_definitiva` como en HU-07 (ese es "Presupuesto
   definitivo" aquí, CA02).
3. `MetaORM.sector`/`MetaORM.meta_cuatrienio` se seleccionan directamente
   (ya documentados y verificados en BD desde D22 -- CA02 lo confirma: "ya
   tienen dato disponible en BD").
4. No hay filtros (HU-10 es exclusivo de la matriz de HU-07); esta HU no
   los pide (CA07 es 100% frontend -- scroll/columnas fijas).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.cortes.persistence.models import ContratoORM, MetaORM, RubroORM
from app.shared.persistence.cruce_fuentes import construir_cruce_fuentes

# _VALORES_TIPO_GASTO_INVERSION y _VALORES_SECTOR_INVALIDOS se unificaron en
# app/shared/persistence/cruce_fuentes.py -- misma regla, ya no duplicada
# entre trazabilidad y plan_accion (ver docstring del módulo).


@dataclass(frozen=True, slots=True)
class FilaPlanAccionCruda:
    """Una fila CRUDA del cruce, antes de agregar por meta. Misma forma que
    `domain.entidades.FilaFuenteMeta` -- ver ese dataclass para el
    significado de cada campo; este solo existe en la capa de persistencia
    para no acoplar el dominio a SQLAlchemy (el repositorio convierte esta
    fila a `FilaFuenteMeta` antes de devolverla a la capa de aplicación)."""

    cod_indicador_producto: str
    nombre_producto: str | None
    sector: str | None
    meta_cuatrienio: Decimal | None
    cod_bpin: str | None
    codigo_rubro: str | None
    presupuesto_apropiado: Decimal | None
    ejecucion: Decimal | None
    numero_contrato: str | None


def construir_filas_plan_accion(sesion: Session, corte_id: uuid.UUID) -> list[FilaPlanAccionCruda]:
    """Extrae el cruce completo de un corte, SIN paginar y SIN agregar.

    Mismas 3 reglas invioables que `trazabilidad` (ver docstring del
    módulo): `ultimo_nivel=true` dentro del JOIN, todos los joins hacia
    afuera son LEFT, y el puente rubro-contrato se deduplica ANTES del
    join principal. Esta HU no pagina (no hay CA de paginación -- el
    volumen esperado, ~144 metas por corte segun CA15 de HU-10, es
    pequeño) ni filtra; la agregación y el armado de la respuesta ocurren
    en capas superiores.
    """
    consulta, _proyectos_del_corte, _puente_rubro_contrato = construir_cruce_fuentes(
        corte_id,
        lambda pdc, _prc: (
            MetaORM.cod_indicador_producto,
            MetaORM.nombre_producto,
            MetaORM.sector,
            MetaORM.meta_cuatrienio,
            pdc.c.bpin.label("cod_bpin"),
            RubroORM.codigo_rubro_nivel.label("codigo_rubro"),
            RubroORM.apropiacion_definitiva.label("presupuesto_apropiado"),
            RubroORM.obligacion_acumulada.label("ejecucion"),
            ContratoORM.numero_contrato,
        ),
    )

    filas = sesion.execute(consulta).all()
    return [
        FilaPlanAccionCruda(
            cod_indicador_producto=f.cod_indicador_producto,
            nombre_producto=f.nombre_producto,
            sector=f.sector,
            meta_cuatrienio=f.meta_cuatrienio,
            cod_bpin=f.cod_bpin,
            codigo_rubro=f.codigo_rubro,
            presupuesto_apropiado=f.presupuesto_apropiado,
            ejecucion=f.ejecucion,
            numero_contrato=f.numero_contrato,
        )
        for f in filas
    ]
