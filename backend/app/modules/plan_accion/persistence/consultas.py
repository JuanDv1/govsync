"""Consulta SQL del Plan de Acción Consolidado (datos crudos, sin agregar).

CAPA: Persistencia
TARJETA: [E04-HU01] Consultar Plan de Acción Consolidado
CUBRE: HU01-CA01, CA02, CA06, CA09 (carga de datos). La AGREGACIÓN por meta
(CA03, CA05, CA08) es responsabilidad de `domain.entidades.agregar_por_meta`
-- este archivo solo extrae, no suma ni agrupa (separación ETL: Extract acá,
Transform en dominio).

=============================================================================
POR QUÉ UNA CONSULTA INDEPENDIENTE Y NO REUTILIZAR `trazabilidad`
=============================================================================
`trazabilidad/persistence/consultas.py::_construir_consulta_base` YA resuelve
el mismo cruce de 4 fuentes con las mismas 3 reglas invioables (ultimo_nivel,
LEFT JOIN, puente deduplicado). Se decidió NO importarla ni modificarla:

  - Modificar ese archivo para esta HU arriesgaría romper HU-07 (ya estable,
    con pruebas propias, en producción conceptual) por un cambio pensado
    para otra HU.
  - Reutilizarla tal cual tampoco sirve: esta HU necesita columnas que
    HU-07 no trae (`sector`, `meta_cuatrienio` de la meta; `codigo_rubro`
    real y `obligacion_acumulada` del rubro) y NO necesita otras que HU-07
    sí trae (`descripcion_contrato`, `nombre_proyecto`).

El costo es una duplicación deliberada y acotada de las 3 reglas del JOIN
(documentadas en detalle en `trazabilidad/persistence/consultas.py` -- leer
ese docstring antes de tocar este archivo, son la misma base de datos y las
mismas reglas de integridad).

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

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.cortes.persistence.models import (
    ContratoORM,
    MetaORM,
    ProyectoIndicadorORM,
    ProyectoORM,
    RegistroPresupuestalORM,
    RubroORM,
)

#: Mismo criterio de tolerancia de grafía que `trazabilidad/persistence/
#: consultas.py` (Tipo Gasto = INVERSIÓN, con o sin tilde).
_VALORES_TIPO_GASTO_INVERSION = ("INVERSION", "INVERSIÓN")

#: Mismo criterio que `trazabilidad` para excluir sector CCPET inválido.
_VALORES_SECTOR_INVALIDOS = ("", "NA")


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
    proyectos_del_corte = (
        select(
            ProyectoIndicadorORM.cod_indicador_producto.label("cod_indicador_producto"),
            ProyectoORM.bpin.label("bpin"),
        )
        .join(ProyectoORM, ProyectoORM.id == ProyectoIndicadorORM.proyecto_id)
        .where(ProyectoORM.corte_id == corte_id)
        .subquery()
    )

    puente_rubro_contrato = (
        select(
            RegistroPresupuestalORM.rubro_id.label("rubro_id"),
            RegistroPresupuestalORM.contrato_id.label("contrato_id"),
        )
        .distinct()
        .where(RegistroPresupuestalORM.rubro_id.is_not(None))
        .subquery()
    )

    consulta = (
        select(
            MetaORM.cod_indicador_producto,
            MetaORM.nombre_producto,
            MetaORM.sector,
            MetaORM.meta_cuatrienio,
            proyectos_del_corte.c.bpin.label("cod_bpin"),
            RubroORM.codigo_rubro_nivel.label("codigo_rubro"),
            RubroORM.apropiacion_definitiva.label("presupuesto_apropiado"),
            RubroORM.obligacion_acumulada.label("ejecucion"),
            ContratoORM.numero_contrato,
        )
        .where(MetaORM.corte_id == corte_id)
        .outerjoin(
            proyectos_del_corte,
            proyectos_del_corte.c.cod_indicador_producto == MetaORM.cod_indicador_producto,
        )
        .outerjoin(
            RubroORM,
            (RubroORM.corte_id == corte_id)
            & (RubroORM.cod_indicador_producto == MetaORM.cod_indicador_producto)
            & (RubroORM.ultimo_nivel.is_(True))
            & RubroORM.codigo_sector_ccpet.is_not(None)
            & (func.upper(RubroORM.codigo_sector_ccpet).notin_(_VALORES_SECTOR_INVALIDOS)),
        )
        .outerjoin(puente_rubro_contrato, puente_rubro_contrato.c.rubro_id == RubroORM.id)
        .outerjoin(
            ContratoORM,
            (ContratoORM.id == puente_rubro_contrato.c.contrato_id)
            & (func.upper(ContratoORM.tipo_gasto).in_(_VALORES_TIPO_GASTO_INVERSION)),
        )
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
