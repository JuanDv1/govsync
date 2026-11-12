"""[E04-HU01-CA03] Desglose de trazabilidad por rubro y contrato, de punta
a punta: base de datos real (SQLite) -> consulta -> dominio -> HTTP.

Las reglas de agregación se prueban una por una en
`test_dominio_plan_accion.py`. Aquí se comprueba que el dato llega completo
a la respuesta de `GET /plan-accion/actual` y que los campos anteriores
(`cod_bpin`, `rubros`, `contratos`) se conservan para el frontend actual.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from app.core.dependencias import obtener_usuario_actual
from app.modules.cortes.domain.entidades import EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import (
    ArchivoFuenteORM,
    ContratoORM,
    CorteORM,
    MetaORM,
    ProyectoIndicadorORM,
    ProyectoORM,
    RegistroPresupuestalORM,
    RubroORM,
)
from app.modules.identidad.domain.entidades import Rol, Usuario

COD = "040110500"
_ADMINISTRADOR = Usuario(
    id="a1", correo="admin@santarosa.gov.co", roles=frozenset({Rol.ADMINISTRADOR})
)


def _corte_registrado_con_una_meta(sesion) -> uuid.UUID:
    corte_id = uuid.uuid4()
    sesion.add(
        CorteORM(
            id=corte_id,
            vigencia=2026,
            fecha_corte=date(2026, 6, 30),
            estado=EstadoCorte.REGISTRADO,
        )
    )
    sesion.flush()
    for tipo in TipoArchivoFuente:
        sesion.add(
            ArchivoFuenteORM(
                id=uuid.uuid4(), corte_id=corte_id, tipo=tipo, nombre_archivo=f"{tipo.value}.xlsx"
            )
        )
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto=COD,
            nombre_producto="Vías mantenidas",
            es_principal=True,
        )
    )
    return corte_id


def _proyecto(sesion, corte_id: uuid.UUID, bpin: str) -> None:
    proyecto_id = uuid.uuid4()
    sesion.add(ProyectoORM(id=proyecto_id, corte_id=corte_id, bpin=bpin))
    sesion.add(
        ProyectoIndicadorORM(id=uuid.uuid4(), proyecto_id=proyecto_id, cod_indicador_producto=COD)
    )


def _rubro(sesion, corte_id: uuid.UUID, codigo: str, presupuesto: str, ejecucion: str) -> uuid.UUID:
    rubro_id = uuid.uuid4()
    sesion.add(
        RubroORM(
            id=rubro_id,
            corte_id=corte_id,
            codigo_rubro_nivel=codigo,
            cod_indicador_producto=COD,
            ultimo_nivel=True,
            codigo_sector_ccpet="24",
            apropiacion_definitiva=Decimal(presupuesto),
            obligacion_acumulada=Decimal(ejecucion),
        )
    )
    return rubro_id


def _contrato(sesion, corte_id: uuid.UUID, numero: str, rubros: list[uuid.UUID], **campos) -> None:
    contrato_id = uuid.uuid4()
    sesion.add(
        ContratoORM(
            id=contrato_id,
            corte_id=corte_id,
            numero_contrato=numero,
            tipo_gasto="INVERSIÓN",
            **campos,
        )
    )
    for rubro_id in rubros:
        sesion.add(
            RegistroPresupuestalORM(id=uuid.uuid4(), rubro_id=rubro_id, contrato_id=contrato_id)
        )


def _unica_fila(cliente) -> dict:
    cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
    respuesta = cliente.get("/api/v1/plan-accion/actual")
    assert respuesta.status_code == 200, respuesta.text
    (fila,) = respuesta.json()["filas"]
    return fila


def test_ca03_la_respuesta_trae_el_desglose_por_rubro_y_contrato(cliente, sesion) -> None:
    corte_id = _corte_registrado_con_una_meta(sesion)
    _proyecto(sesion, corte_id, "202500000050132")
    rubro_1 = _rubro(sesion, corte_id, "R-1", "1000", "400")
    rubro_2 = _rubro(sesion, corte_id, "R-2", "500", "0")
    _contrato(
        sesion,
        corte_id,
        "CT-001",
        [rubro_1],
        objeto="Mantenimiento vial",
        valor_contrato=Decimal("300"),
        valor_pagado=Decimal("100"),
    )
    _contrato(sesion, corte_id, "CT-002", [rubro_1, rubro_2], objeto="Interventoría")
    sesion.commit()

    fila = _unica_fila(cliente)

    rubro_r1, rubro_r2 = fila["desglose"]
    assert rubro_r1["codigo_rubro"] == "R-1"
    assert Decimal(rubro_r1["presupuesto_definitivo"]) == Decimal("1000")
    assert Decimal(rubro_r1["ejecucion"]) == Decimal("400")
    assert [c["numero_contrato"] for c in rubro_r1["contratos"]] == ["CT-001", "CT-002"]
    contrato = rubro_r1["contratos"][0]
    assert contrato["objeto"] == "Mantenimiento vial"
    assert Decimal(contrato["valor"]) == Decimal("300")
    assert Decimal(contrato["valor_pagado"]) == Decimal("100")
    assert [c["numero_contrato"] for c in rubro_r2["contratos"]] == ["CT-002"]


def test_ca03_el_desglose_suma_exactamente_los_totales_de_la_meta(cliente, sesion) -> None:
    """Dos BPIN x dos rubros x dos contratos generan muchas filas crudas en
    el cruce; el total de la meta sigue siendo la suma de sus rubros."""
    corte_id = _corte_registrado_con_una_meta(sesion)
    _proyecto(sesion, corte_id, "202500000050132")
    _proyecto(sesion, corte_id, "202500000050299")
    rubro_1 = _rubro(sesion, corte_id, "R-1", "1000", "400")
    rubro_2 = _rubro(sesion, corte_id, "R-2", "500", "50")
    _contrato(sesion, corte_id, "CT-001", [rubro_1, rubro_2])
    _contrato(sesion, corte_id, "CT-002", [rubro_1])
    sesion.commit()

    fila = _unica_fila(cliente)

    assert Decimal(fila["presupuesto_definitivo"]) == Decimal("1500")
    assert Decimal(fila["ejecucion"]) == Decimal("450")
    assert sum(Decimal(r["presupuesto_definitivo"]) for r in fila["desglose"]) == Decimal("1500")
    assert sum(Decimal(r["ejecucion"]) for r in fila["desglose"]) == Decimal("450")
    assert Decimal(fila["avance_financiero_pct"]) == Decimal("30")


def test_h027_una_meta_con_dos_bpin_los_devuelve_todos(cliente, sesion) -> None:
    corte_id = _corte_registrado_con_una_meta(sesion)
    _proyecto(sesion, corte_id, "202500000050299")
    _proyecto(sesion, corte_id, "202500000050132")
    sesion.commit()

    fila = _unica_fila(cliente)

    assert fila["bpins"] == ["202500000050132", "202500000050299"]
    # Campo anterior, conservado para el frontend actual: el primero.
    assert fila["cod_bpin"] == "202500000050132"


def test_los_campos_anteriores_de_la_respuesta_se_conservan(cliente, sesion) -> None:
    corte_id = _corte_registrado_con_una_meta(sesion)
    rubro = _rubro(sesion, corte_id, "R-1", "1000", "400")
    _contrato(sesion, corte_id, "CT-001", [rubro])
    sesion.commit()

    fila = _unica_fila(cliente)

    assert fila["rubros"] == ["R-1"]
    assert fila["contratos"] == ["CT-001"]
    assert fila["cod_bpin"] is None
    assert fila["bpins"] == []


def test_meta_sin_rubros_devuelve_desglose_vacio(cliente, sesion) -> None:
    _corte_registrado_con_una_meta(sesion)
    sesion.commit()

    fila = _unica_fila(cliente)

    assert fila["desglose"] == []
    assert fila["estado_cruce"] == "sin_informacion"
