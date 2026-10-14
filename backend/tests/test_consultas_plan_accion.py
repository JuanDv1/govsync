"""Pruebas de `construir_filas_plan_accion` (extracción cruda, capa de
persistencia del Plan de Acción Consolidado).

TARJETA: [E04-HU01]
CUBRE: HU01-CA02 (columnas disponibles), CA06/CA-8 heredado (NULL
explícito), fan-out de rubro->contrato (insumo crudo que
`agregar_por_meta`, ya probado en test_dominio_plan_accion.py, deduplica).

Mismo patrón y mismos helpers que `test_consultas_matriz.py` (HU-07): aquí
solo se prueba la EXTRACCIÓN (sin agregar), por eso las aserciones son
sobre `FilaPlanAccionCruda` cruda, incluido el fan-out intencional que
`agregar_por_meta` resuelve en la capa de dominio.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from app.modules.cortes.domain.entidades import EstadoCorte
from app.modules.cortes.persistence.models import (
    ContratoORM,
    CorteORM,
    MetaORM,
    ProyectoIndicadorORM,
    ProyectoORM,
    RegistroPresupuestalORM,
    RubroORM,
)
from app.modules.plan_accion.persistence.consultas import construir_filas_plan_accion

COD_1 = "170202300"


def _crear_corte(
    sesion,
    *,
    estado: EstadoCorte = EstadoCorte.BORRADOR,
    vigencia: int = 2026,
    fecha: date = date(2026, 1, 1),
) -> uuid.UUID:
    corte_id = uuid.uuid4()
    sesion.add(CorteORM(id=corte_id, vigencia=vigencia, fecha_corte=fecha, estado=estado))
    sesion.flush()
    return corte_id


def _crear_meta(sesion, corte_id, cod, *, nombre=None, sector=None, meta_cuatrienio=None) -> None:
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto=cod,
            nombre_producto=nombre,
            sector=sector,
            meta_cuatrienio=meta_cuatrienio,
            es_principal=True,
        )
    )


def _crear_proyecto_con_indicador(sesion, corte_id, bpin, cod) -> None:
    proyecto_id = uuid.uuid4()
    sesion.add(ProyectoORM(id=proyecto_id, corte_id=corte_id, bpin=bpin))
    sesion.add(
        ProyectoIndicadorORM(id=uuid.uuid4(), proyecto_id=proyecto_id, cod_indicador_producto=cod)
    )


def _crear_rubro(
    sesion,
    corte_id,
    cod,
    *,
    codigo_rubro_nivel="nivel-1",
    apropiacion_definitiva=None,
    obligacion_acumulada=None,
) -> uuid.UUID:
    rubro_id = uuid.uuid4()
    sesion.add(
        RubroORM(
            id=rubro_id,
            corte_id=corte_id,
            codigo_rubro_nivel=codigo_rubro_nivel,
            cod_indicador_producto=cod,
            ultimo_nivel=True,
            codigo_sector_ccpet="01",
            apropiacion_definitiva=apropiacion_definitiva,
            obligacion_acumulada=obligacion_acumulada,
        )
    )
    return rubro_id


def _crear_contrato(sesion, corte_id, numero) -> uuid.UUID:
    contrato_id = uuid.uuid4()
    sesion.add(
        ContratoORM(
            id=contrato_id,
            corte_id=corte_id,
            numero_contrato=numero,
            tipo_gasto="INVERSIÓN",
        )
    )
    return contrato_id


def _crear_registro(sesion, rubro_id, contrato_id) -> None:
    sesion.add(RegistroPresupuestalORM(id=uuid.uuid4(), rubro_id=rubro_id, contrato_id=contrato_id))


class TestConstruirFilasPlanAccion:
    def test_meta_completa_trae_sector_meta_cuatrienio_y_ejecucion(self, sesion) -> None:
        corte_id = _crear_corte(sesion)
        _crear_meta(
            sesion,
            corte_id,
            COD_1,
            nombre="Vias terciarias mantenidas",
            sector="Infraestructura",
            meta_cuatrienio=Decimal("40"),
        )
        _crear_proyecto_con_indicador(sesion, corte_id, "202500000050132", COD_1)
        rubro_id = _crear_rubro(
            sesion,
            corte_id,
            COD_1,
            apropiacion_definitiva=Decimal("1000000"),
            obligacion_acumulada=Decimal("250000"),
        )
        contrato_id = _crear_contrato(sesion, corte_id, "C-001")
        _crear_registro(sesion, rubro_id, contrato_id)
        sesion.flush()

        filas = construir_filas_plan_accion(sesion, corte_id)

        assert len(filas) == 1
        fila = filas[0]
        assert fila.sector == "Infraestructura"
        assert fila.meta_cuatrienio == Decimal("40")
        assert fila.cod_bpin == "202500000050132"
        assert fila.codigo_rubro == "nivel-1"
        assert fila.presupuesto_apropiado == Decimal("1000000")
        # D26: "Ejecución" = obligacion_acumulada, NO apropiacion_definitiva.
        assert fila.ejecucion == Decimal("250000")
        assert fila.numero_contrato == "C-001"

    def test_meta_sin_ninguna_correspondencia_trae_null_explicito(self, sesion) -> None:
        corte_id = _crear_corte(sesion)
        _crear_meta(sesion, corte_id, COD_1, sector="Educación")
        sesion.flush()

        filas = construir_filas_plan_accion(sesion, corte_id)

        assert len(filas) == 1
        fila = filas[0]
        assert fila.sector == "Educación"
        assert fila.cod_bpin is None
        assert fila.codigo_rubro is None
        assert fila.presupuesto_apropiado is None
        assert fila.ejecucion is None
        assert fila.numero_contrato is None

    def test_un_rubro_con_tres_contratos_produce_tres_filas_crudas_fan_out(self, sesion) -> None:
        """Fan-out intencional (CA-7, heredado de HU-07): la deduplicación
        por dinero ocurre en `agregar_por_meta`, NO aquí -- ver su
        docstring y `test_dominio_plan_accion.py::
        TestAgregarPorMetaSinDuplicarDinero`."""
        corte_id = _crear_corte(sesion)
        _crear_meta(sesion, corte_id, COD_1)
        rubro_id = _crear_rubro(sesion, corte_id, COD_1, apropiacion_definitiva=Decimal("5000"))
        for numero in ("C-001", "C-002", "C-003"):
            contrato_id = _crear_contrato(sesion, corte_id, numero)
            _crear_registro(sesion, rubro_id, contrato_id)
        sesion.flush()

        filas = construir_filas_plan_accion(sesion, corte_id)

        assert len(filas) == 3
        assert {f.numero_contrato for f in filas} == {"C-001", "C-002", "C-003"}
        assert all(f.presupuesto_apropiado == Decimal("5000") for f in filas)

    def test_metas_de_otro_corte_no_aparecen(self, sesion) -> None:
        # Solo puede existir un corte BORRADOR a la vez, y (vigencia,
        # fecha_corte) es UNIQUE -- el segundo corte se crea REGISTRADO con
        # vigencia y fecha distintas para no chocar con ninguna restricción.
        corte_a = _crear_corte(sesion)
        corte_b = _crear_corte(
            sesion, estado=EstadoCorte.REGISTRADO, vigencia=2025, fecha=date(2025, 1, 1)
        )
        _crear_meta(sesion, corte_a, COD_1, sector="A")
        _crear_meta(sesion, corte_b, COD_1, sector="B")
        sesion.flush()

        filas = construir_filas_plan_accion(sesion, corte_a)

        assert len(filas) == 1
        assert filas[0].sector == "A"
