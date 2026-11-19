"""Construcción común del cruce de las 4 fuentes (meta/proyecto/rubro/contrato).

CAPA: Persistencia (compartida entre módulos)
ORIGEN: extraído de la duplicación DELIBERADA (y documentada como tal) entre
`trazabilidad/persistence/consultas.py::_construir_consulta_base` y
`plan_accion/persistence/consultas.py::construir_filas_plan_accion`.

Por qué existía la duplicación (ver docstring original de plan_accion, sección
"POR QUÉ UNA CONSULTA INDEPENDIENTE Y NO REUTILIZAR `trazabilidad`"): las dos
HU necesitan proyectar columnas distintas sobre EL MISMO cruce, y el equipo
decidió entonces no acoplar un módulo al otro. Esa razón sigue siendo válida
-- este archivo NO hace que un módulo dependa del otro. Lo que unifica es la
parte que de verdad era 100% idéntica entre ambos: las dos subconsultas-puente
y la cadena de 4 LEFT JOIN con las "TRES REGLAS QUE NO SE PUEDEN ROMPER" (ver
docstring de `trazabilidad/persistence/consultas.py` para el detalle de cada
regla). Antes, un cambio en esa cadena de JOIN exigía recordar editar los DOS
archivos a la vez (y nada lo verificaba); ahora hay una sola función que la
construye.

Cada módulo sigue eligiendo LIBREMENTE qué columnas proyectar -- se le pasa
una función (`construir_columnas`) que recibe las dos subconsultas-puente ya
resueltas y devuelve la lista de columnas a seleccionar. Así ningún módulo
queda forzado a traer columnas que no necesita, y no se usa ningún mecanismo
avanzado de SQLAlchemy (`with_only_columns`, etc.) para "cambiar" columnas
después de armado el SELECT -- se eligen de una sola vez, de forma explícita.

DECISIÓN TÉCNICA (equipo, 2026-10-29): ubicación en `app/shared/persistence/`
y no en `app/shared/` directamente ni en `app/modules/*/persistence/`.
Importa porque `tests/test_arquitectura.py` solo clasifica como "dominio"
(y por lo tanto prohíbe SQLAlchemy) a los archivos que matchean el patrón
`shared/*.py` -- es decir, los hijos DIRECTOS de `shared/`, no los de un
subpaquete como `shared/persistence/`. Verificado leyendo ese test antes de
crear este archivo. Tampoco infringe
`test_los_modulos_no_dependen_unos_de_otros_por_persistencia`: ese test
prohíbe que un módulo importe `app.modules.<OTRO_MODULO>.persistence.*`;
ninguno de los dos módulos importa del otro, ambos importan de `app.shared`,
que es código explícitamente compartido y no pertenece a ningún módulo.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable, Sequence
from typing import Any

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.sql.selectable import Subquery

from app.modules.cortes.persistence.models import (
    ContratoORM,
    MetaORM,
    ProyectoIndicadorORM,
    ProyectoORM,
    RegistroPresupuestalORM,
    RubroORM,
)

#: Tipo Gasto = INVERSIÓN (con o sin tilde, ver tolerancia de grafía ya usada
#: por los lectores de ingesta). Única fuente para trazabilidad y plan_accion
#: -- antes vivía duplicada, byte a byte, en los dos módulos.
VALORES_TIPO_GASTO_INVERSION = ("INVERSION", "INVERSIÓN")

#: CodigoSectorCcpet inválido (vacío o "NA", en mayúsculas). Misma razón.
VALORES_SECTOR_INVALIDOS = ("", "NA")


def construir_cruce_fuentes(
    corte_id: uuid.UUID,
    construir_columnas: Callable[[Subquery, Subquery], Sequence[ColumnElement[Any]]],
) -> tuple[Select, Subquery, Subquery]:
    """Arma el cruce de las 4 fuentes para un corte y devuelve
    `(consulta, proyectos_del_corte, puente_rubro_contrato)`.

    `construir_columnas(proyectos_del_corte, puente_rubro_contrato)` debe
    devolver la lista de columnas a proyectar -- recibe las dos
    subconsultas-puente ya resueltas para poder referenciar sus columnas
    (p. ej. `proyectos_del_corte.c.bpin`). El llamador es responsable de
    aplicar DESPUÉS cualquier filtro propio (`estado_cruce`, `busqueda`,
    HU-10, etc.) sobre el `Select` devuelto -- esta función NO filtra nada
    de negocio, solo construye el JOIN.

    Se devuelven también las dos subconsultas porque los filtros de HU-07/
    HU-10 (`bpin`, `busqueda`, `estado_cruce`) necesitan referenciarlas
    (p. ej. `proyectos_del_corte.c.bpin.is_(None)`).

    TRES REGLAS QUE NO SE PUEDEN ROMPER (idénticas a las documentadas en
    `trazabilidad/persistence/consultas.py` -- leer ese docstring para el
    detalle y el porqué de cada una; aquí solo se resume):

    1. `RubroORM.ultimo_nivel.is_(True)` DENTRO del JOIN (evita duplicar
       metas por los subtotales jerárquicos de ejecución).
    2. Todos los joins desde `MetaORM` hacia afuera son `outerjoin` (CA-8:
       una meta sin match sigue apareciendo, con NULL explícito).
    3. El puente `registro_presupuestal` -> `contrato` se deduplica POR
       (rubro_id, contrato_id) ANTES del join principal, nunca con un
       DISTINCT/LIMIT 1 sobre el resultado final (CA-7: eso colapsaría
       relaciones 1:N válidas).
    """
    proyectos_del_corte = (
        select(
            ProyectoIndicadorORM.cod_indicador_producto.label("cod_indicador_producto"),
            ProyectoORM.bpin.label("bpin"),
            ProyectoORM.nombre_proyecto.label("nombre_proyecto"),
        )
        .join(ProyectoORM, ProyectoORM.id == ProyectoIndicadorORM.proyecto_id)
        .where(ProyectoORM.corte_id == corte_id)
        .subquery()
    )

    # CA-7/[HU-07][BE-02]: deduplicar el PUENTE, no el resultado (Regla 3).
    puente_rubro_contrato = (
        select(
            RegistroPresupuestalORM.rubro_id.label("rubro_id"),
            RegistroPresupuestalORM.contrato_id.label("contrato_id"),
        )
        .distinct()
        .where(RegistroPresupuestalORM.rubro_id.is_not(None))
        .subquery()
    )

    columnas = construir_columnas(proyectos_del_corte, puente_rubro_contrato)

    consulta = (
        select(*columnas)
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
            & (func.upper(RubroORM.codigo_sector_ccpet).notin_(VALORES_SECTOR_INVALIDOS)),
        )
        .outerjoin(puente_rubro_contrato, puente_rubro_contrato.c.rubro_id == RubroORM.id)
        .outerjoin(
            ContratoORM,
            (ContratoORM.id == puente_rubro_contrato.c.contrato_id)
            & (func.upper(ContratoORM.tipo_gasto).in_(VALORES_TIPO_GASTO_INVERSION)),
        )
    )

    return consulta, proyectos_del_corte, puente_rubro_contrato
