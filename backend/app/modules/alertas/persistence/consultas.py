"""Detección de registros no relacionados de un corte (consultas anti-join).

CAPA: Persistencia
TARJETA: [E-04/HU-05] BE - Visualizar registros no relacionados.
CUBRE: HU05-CA01/CA02/CA03 (una consulta por motivo del catálogo cerrado).

POR QUÉ NO SE REUTILIZA `construir_cruce_fuentes`
-------------------------------------------------
Ese cruce parte de la META y hace LEFT JOIN hacia afuera: sirve para saber
qué le falta a cada meta, pero no ve los rubros, registros y proyectos que
no llegan a ninguna meta (la mitad del catálogo). Aquí cada motivo es una
consulta propia con `NOT EXISTS` desde el registro que se reporta. Lo que SÍ
se reutiliza son las reglas del cruce (`VALORES_SECTOR_INVALIDOS`, regla
1b, y `VALORES_TIPO_GASTO_INVERSION`, regla 1c): lo excluido a propósito
del cruce tampoco cuenta como "no relacionado" (decisión 5 del
refinamiento) y las dos HU no pueden divergir en eso.

DECISIÓN TÉCNICA (pendiente de acordar con Cristhian en el spec): qué va en
Código y Descripción de cada fuente, que la hoja HU_E04_05 no define:
- Meta: código de indicador de producto / nombre del producto.
- Rubro: `codigo_rubro_nivel` (la llave real del rubro, Decisión 3) /
  "Indicador <código>" (si lo tiene) y el nombre del sector.
- Registro presupuestal: código de rubro tal como viene en el registro /
  "Contrato <número>".
- Contrato: número de contrato / objeto.
- Proyecto: BPIN / nombre del proyecto (más el indicador o el texto crudo
  del indicador, según el motivo).
"""

from __future__ import annotations

import uuid

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.modules.alertas.domain.registros_no_relacionados import (
    Motivo,
    RegistroNoRelacionado,
    clave_bpin,
)
from app.modules.cortes.persistence.models import (
    ContratoORM,
    MetaORM,
    ProyectoIndicadorORM,
    ProyectoORM,
    RegistroPresupuestalORM,
    RubroORM,
)
from app.shared.persistence.cruce_fuentes import (
    VALORES_SECTOR_INVALIDOS,
    VALORES_TIPO_GASTO_INVERSION,
)


def listar_registros_no_relacionados(
    sesion: Session, corte_id: uuid.UUID
) -> list[RegistroNoRelacionado]:
    """Todos los registros no relacionados del corte, sin filtrar ni
    ordenar (eso lo hace el dominio). Nueve consultas, una por motivo."""
    return [
        *_metas_sin_proyecto(sesion, corte_id),
        *_metas_sin_ejecucion(sesion, corte_id),
        *_metas_sin_contrato(sesion, corte_id),
        *_rubros_con_indicador_fuera_del_pdt(sesion, corte_id),
        *_rubros_sin_indicador(sesion, corte_id),
        *_registros_con_rubro_inexistente(sesion, corte_id),
        *_contratos_con_bpin_fuera_de_la_plantilla(sesion, corte_id),
        *_proyectos_con_indicador_fuera_del_pdt(sesion, corte_id),
        *_proyectos_sin_indicador(sesion, corte_id),
    ]


# --- Condiciones compartidas (reglas del cruce) -----------------------------


def _rubro_valido(corte_id: uuid.UUID):
    """Rubro que el cruce SÍ considera: último nivel (regla 1) y sector
    válido (regla 1b). Los subtotales y los de sector vacío o "NA" se
    excluyen a propósito y no son "no relacionados"."""
    return (
        (RubroORM.corte_id == corte_id)
        & RubroORM.ultimo_nivel.is_(True)
        & RubroORM.codigo_sector_ccpet.is_not(None)
        & func.upper(RubroORM.codigo_sector_ccpet).notin_(VALORES_SECTOR_INVALIDOS)
    )


def _contrato_de_inversion():
    """Regla 1c: solo contratos con tipo de gasto INVERSIÓN."""
    return func.upper(ContratoORM.tipo_gasto).in_(VALORES_TIPO_GASTO_INVERSION)


def _metas_del_corte(corte_id: uuid.UUID):
    """Una fila por código de meta (el Plan de Acción agrupa por código; la
    tabla `meta` no tiene unicidad por corte y código)."""
    return (
        select(
            MetaORM.cod_indicador_producto.label("codigo"),
            func.min(MetaORM.nombre_producto).label("nombre"),
        )
        .where(MetaORM.corte_id == corte_id)
        .group_by(MetaORM.cod_indicador_producto)
        .subquery()
    )


def _hay_meta_con_codigo(corte_id: uuid.UUID, columna_codigo):
    return exists().where(
        (MetaORM.corte_id == corte_id) & (MetaORM.cod_indicador_producto == columna_codigo)
    )


def _descripcion(*partes: str | None) -> str | None:
    texto = " · ".join(p for p in partes if p)
    return texto or None


# --- Plan Indicativo --------------------------------------------------------


def _metas_sin_proyecto(sesion, corte_id) -> list[RegistroNoRelacionado]:
    metas = _metas_del_corte(corte_id)
    hay_proyecto = exists().where(
        (ProyectoORM.id == ProyectoIndicadorORM.proyecto_id)
        & (ProyectoORM.corte_id == corte_id)
        & (ProyectoIndicadorORM.cod_indicador_producto == metas.c.codigo)
    )
    filas = sesion.execute(select(metas.c.codigo, metas.c.nombre).where(~hay_proyecto))
    return [_fila_meta(Motivo.META_SIN_PROYECTO, codigo, nombre) for codigo, nombre in filas]


def _metas_sin_ejecucion(sesion, corte_id) -> list[RegistroNoRelacionado]:
    metas = _metas_del_corte(corte_id)
    hay_rubro = exists().where(
        _rubro_valido(corte_id) & (RubroORM.cod_indicador_producto == metas.c.codigo)
    )
    filas = sesion.execute(select(metas.c.codigo, metas.c.nombre).where(~hay_rubro))
    return [_fila_meta(Motivo.META_SIN_EJECUCION, codigo, nombre) for codigo, nombre in filas]


def _metas_sin_contrato(sesion, corte_id) -> list[RegistroNoRelacionado]:
    """Tiene rubro válido, pero ninguno de sus rubros llega a un contrato
    de INVERSIÓN por un registro presupuestal. Una meta sin rubro no entra
    aquí: ya la reporta `meta_sin_ejecucion`."""
    metas = _metas_del_corte(corte_id)
    hay_rubro = exists().where(
        _rubro_valido(corte_id) & (RubroORM.cod_indicador_producto == metas.c.codigo)
    )
    hay_contrato = exists().where(
        _rubro_valido(corte_id)
        & (RubroORM.cod_indicador_producto == metas.c.codigo)
        & (RegistroPresupuestalORM.rubro_id == RubroORM.id)
        & (ContratoORM.id == RegistroPresupuestalORM.contrato_id)
        & _contrato_de_inversion()
    )
    filas = sesion.execute(select(metas.c.codigo, metas.c.nombre).where(hay_rubro & ~hay_contrato))
    return [_fila_meta(Motivo.META_SIN_CONTRATO, codigo, nombre) for codigo, nombre in filas]


def _fila_meta(motivo: Motivo, codigo: str, nombre: str | None) -> RegistroNoRelacionado:
    return RegistroNoRelacionado(motivo=motivo, codigo=codigo, descripcion=nombre, valor=None)


# --- Presupuestal -----------------------------------------------------------


def _rubros_con_indicador_fuera_del_pdt(sesion, corte_id) -> list[RegistroNoRelacionado]:
    consulta = select(RubroORM).where(
        _rubro_valido(corte_id)
        & RubroORM.cod_indicador_producto.is_not(None)
        & ~_hay_meta_con_codigo(corte_id, RubroORM.cod_indicador_producto)
    )
    return [
        _fila_rubro(Motivo.RUBRO_INDICADOR_NO_EXISTE_EN_PDT, r) for r in sesion.scalars(consulta)
    ]


def _rubros_sin_indicador(sesion, corte_id) -> list[RegistroNoRelacionado]:
    consulta = select(RubroORM).where(
        _rubro_valido(corte_id) & RubroORM.cod_indicador_producto.is_(None)
    )
    return [_fila_rubro(Motivo.RUBRO_SIN_INDICADOR, r) for r in sesion.scalars(consulta)]


def _fila_rubro(motivo: Motivo, rubro: RubroORM) -> RegistroNoRelacionado:
    indicador = (
        f"Indicador {rubro.cod_indicador_producto}" if rubro.cod_indicador_producto else None
    )
    return RegistroNoRelacionado(
        motivo=motivo,
        codigo=rubro.codigo_rubro_nivel,
        descripcion=_descripcion(indicador, rubro.nombre_sector_ccpet),
        valor=rubro.apropiacion_definitiva,
    )


def _registros_con_rubro_inexistente(sesion, corte_id) -> list[RegistroNoRelacionado]:
    """`rubro_id` NULL = el código de rubro del registro no se encontró en
    la ejecución al cargar (Decisión 5). Solo contratos de INVERSIÓN."""
    consulta = (
        select(
            RegistroPresupuestalORM.codigo_rubro_crudo,
            ContratoORM.numero_contrato,
            ContratoORM.llave_sustituta,
            RegistroPresupuestalORM.valor_registro_ptal,
        )
        .join(ContratoORM, ContratoORM.id == RegistroPresupuestalORM.contrato_id)
        .where(
            (ContratoORM.corte_id == corte_id)
            & RegistroPresupuestalORM.rubro_id.is_(None)
            & _contrato_de_inversion()
        )
    )
    return [
        RegistroNoRelacionado(
            motivo=Motivo.REGISTRO_RUBRO_NO_EXISTE,
            codigo=codigo_rubro,
            descripcion=_descripcion(f"Contrato {numero or llave}" if numero or llave else None),
            valor=valor,
        )
        for codigo_rubro, numero, llave, valor in sesion.execute(consulta)
    ]


def _contratos_con_bpin_fuera_de_la_plantilla(sesion, corte_id) -> list[RegistroNoRelacionado]:
    """Verificación de calidad del dato (decisión 4 del refinamiento): el
    BPIN del contrato se compara con los BPIN de la plantilla del corte, un
    enlace que el cruce no usa.

    La comparación se hace en Python con `clave_bpin` (año + consecutivo,
    sin ceros de relleno) y no en SQL: convertir el consecutivo a número en
    SQL fallaría en PostgreSQL con un BPIN que no sea todo dígitos. El
    volumen es pequeño (los contratos de un corte, ~270 con los archivos
    reales)."""
    plantilla = {
        clave_bpin(bpin)
        for bpin in sesion.scalars(
            select(ProyectoORM.bpin).where(
                (ProyectoORM.corte_id == corte_id) & ProyectoORM.bpin.is_not(None)
            )
        )
    }
    consulta = select(ContratoORM).where(
        (ContratoORM.corte_id == corte_id)
        & ContratoORM.bpin.is_not(None)
        & _contrato_de_inversion()
    )
    return [
        RegistroNoRelacionado(
            motivo=Motivo.CONTRATO_BPIN_NO_EXISTE_EN_PLANTILLA,
            codigo=c.numero_contrato or c.llave_sustituta,
            descripcion=_descripcion(f"BPIN {c.bpin}", c.objeto),
            valor=c.valor_contrato,
        )
        for c in sesion.scalars(consulta)
        if clave_bpin(c.bpin) not in plantilla
    ]


# --- BPIN -------------------------------------------------------------------


def _proyectos_con_indicador_fuera_del_pdt(sesion, corte_id) -> list[RegistroNoRelacionado]:
    """Una fila por (proyecto, indicador): cada indicador que no está en el
    Plan Indicativo es una inconsistencia distinta que revisar."""
    consulta = (
        select(
            ProyectoORM.bpin,
            ProyectoORM.nombre_proyecto,
            ProyectoIndicadorORM.cod_indicador_producto,
        )
        .join(ProyectoIndicadorORM, ProyectoIndicadorORM.proyecto_id == ProyectoORM.id)
        .where(
            (ProyectoORM.corte_id == corte_id)
            & ~_hay_meta_con_codigo(corte_id, ProyectoIndicadorORM.cod_indicador_producto)
        )
    )
    return [
        RegistroNoRelacionado(
            motivo=Motivo.PROYECTO_INDICADOR_NO_EXISTE_EN_PDT,
            codigo=bpin,
            descripcion=_descripcion(f"Indicador {indicador}", nombre),
            valor=None,
        )
        for bpin, nombre, indicador in sesion.execute(consulta)
    ]


def _proyectos_sin_indicador(sesion, corte_id) -> list[RegistroNoRelacionado]:
    """Proyecto sin ningún indicador reconocible: se muestra el texto crudo
    del indicador para que la administradora vea por qué no se reconoció."""
    tiene_indicador = exists().where(ProyectoIndicadorORM.proyecto_id == ProyectoORM.id)
    consulta = select(ProyectoORM).where((ProyectoORM.corte_id == corte_id) & ~tiene_indicador)
    return [
        RegistroNoRelacionado(
            motivo=Motivo.PROYECTO_SIN_INDICADOR,
            codigo=p.bpin,
            descripcion=_descripcion(
                p.nombre_proyecto,
                f"Indicador en el archivo: {p.indicador_producto_raw}"
                if p.indicador_producto_raw
                else None,
            ),
            valor=None,
        )
        for p in sesion.scalars(consulta)
    ]
