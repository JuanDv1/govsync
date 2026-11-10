"""[E04-HU07] Metas con menos del 50 % de avance financiero.

Dominio (regla pura) y endpoint `GET /plan-accion/riesgo` con SQL real.
Los CA son los de la hoja HU_E04_07 del levantamiento v3.0.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from app.core.dependencias import obtener_usuario_actual
from app.modules.cortes.domain.entidades import EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import ArchivoFuenteORM, CorteORM, MetaORM, RubroORM
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.modules.plan_accion.domain.entidades import FilaFuenteMeta, agregar_por_meta
from app.modules.plan_accion.domain.riesgo import metas_en_riesgo

_VISITANTE = Usuario(id="v1", correo="alcalde@santarosa.gov.co", roles=frozenset({Rol.VISITANTE}))
_GESTOR = Usuario(id="g1", correo="gestor@santarosa.gov.co", roles=frozenset({Rol.GESTOR}))


def _meta(cod: str, presupuesto: str | None, ejecucion: str | None):
    """Una meta ya agregada, construida con la regla real de agregación."""
    (fila,) = agregar_por_meta(
        [
            FilaFuenteMeta(
                cod_indicador_producto=cod,
                nombre_producto=f"Meta {cod}",
                sector="Educación",
                meta_cuatrienio=None,
                cod_bpin=None,
                codigo_rubro=None if presupuesto is None else f"R-{cod}",
                presupuesto_apropiado=None if presupuesto is None else Decimal(presupuesto),
                ejecucion=None if ejecucion is None else Decimal(ejecucion),
                numero_contrato=None,
            )
        ]
    )
    return fila


class TestMetasEnRiesgoDominio:
    def test_ca02_presupuesto_1000_y_ejecucion_400_es_40_por_ciento_y_es_riesgo(self):
        resultado = metas_en_riesgo([_meta("000000001", "1000", "400")])

        (meta,) = resultado.en_riesgo
        assert meta.avance_financiero_pct == Decimal("40")

    def test_ca01_una_meta_por_encima_del_umbral_no_aparece(self):
        resultado = metas_en_riesgo([_meta("000000001", "1000", "800")])

        assert resultado.en_riesgo == ()

    def test_ca03_exactamente_50_por_ciento_no_es_riesgo(self):
        resultado = metas_en_riesgo([_meta("000000001", "1000", "500")])

        assert resultado.en_riesgo == ()

    def test_ca03_apenas_por_debajo_de_50_si_es_riesgo(self):
        resultado = metas_en_riesgo([_meta("000000001", "1000", "499.99")])

        assert len(resultado.en_riesgo) == 1

    def test_ca04_presupuesto_cero_no_se_calcula_ni_aparece_y_se_cuenta_aparte(self):
        resultado = metas_en_riesgo([_meta("000000001", "0", "0")])

        assert resultado.en_riesgo == ()
        assert resultado.sin_presupuesto == 1

    def test_ca04_meta_sin_ningun_rubro_cuenta_como_sin_presupuesto(self):
        resultado = metas_en_riesgo([_meta("000000001", None, None)])

        assert resultado.en_riesgo == ()
        assert resultado.sin_presupuesto == 1

    def test_ca05_ordena_de_menor_a_mayor_avance(self):
        resultado = metas_en_riesgo(
            [
                _meta("000000001", "1000", "300"),
                _meta("000000002", "1000", "0"),
                _meta("000000003", "1000", "450"),
            ]
        )

        assert [m.cod_indicador_producto for m in resultado.en_riesgo] == [
            "000000002",
            "000000001",
            "000000003",
        ]

    def test_ca05_con_el_mismo_avance_el_orden_es_estable_por_codigo(self):
        resultado = metas_en_riesgo(
            [_meta("000000002", "1000", "100"), _meta("000000001", "1000", "100")]
        )

        assert [m.cod_indicador_producto for m in resultado.en_riesgo] == [
            "000000001",
            "000000002",
        ]

    def test_ca07_sin_metas_en_riesgo_la_lista_es_vacia(self):
        resultado = metas_en_riesgo([])

        assert resultado.en_riesgo == ()
        assert resultado.sin_presupuesto == 0

    def test_una_meta_con_presupuesto_pero_sin_dato_de_ejecucion_no_se_clasifica(self):
        resultado = metas_en_riesgo([_meta("000000001", "1000", None)])

        assert resultado.en_riesgo == ()
        assert resultado.sin_presupuesto == 0


def _corte_registrado(sesion) -> uuid.UUID:
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
    return corte_id


def _meta_con_rubro(sesion, corte_id, cod: str, presupuesto: str, ejecucion: str) -> None:
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto=cod,
            nombre_producto=f"Meta {cod}",
            sector="Educación",
            es_principal=True,
        )
    )
    sesion.add(
        RubroORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            codigo_rubro_nivel=f"R-{cod}",
            cod_indicador_producto=cod,
            ultimo_nivel=True,
            codigo_sector_ccpet="22",
            apropiacion_definitiva=Decimal(presupuesto),
            obligacion_acumulada=Decimal(ejecucion),
        )
    )


class TestEndpointMetasEnRiesgo:
    def test_devuelve_solo_las_metas_en_riesgo_ordenadas(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _VISITANTE
        corte_id = _corte_registrado(sesion)
        _meta_con_rubro(sesion, corte_id, "000000001", "1000", "400")
        _meta_con_rubro(sesion, corte_id, "000000002", "1000", "900")
        _meta_con_rubro(sesion, corte_id, "000000003", "1000", "100")
        _meta_con_rubro(sesion, corte_id, "000000004", "0", "0")
        sesion.commit()

        respuesta = cliente.get("/api/v1/plan-accion/riesgo")

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["corte_id"] == str(corte_id)
        assert Decimal(cuerpo["umbral_pct"]) == Decimal("50")
        assert [f["cod_indicador_producto"] for f in cuerpo["filas"]] == [
            "000000003",
            "000000001",
        ]
        assert Decimal(cuerpo["filas"][0]["avance_financiero_pct"]) == Decimal("10")
        assert cuerpo["total_en_riesgo"] == 2
        assert cuerpo["metas_sin_presupuesto"] == 1

    def test_ca07_sin_metas_en_riesgo_devuelve_200_con_lista_vacia(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _VISITANTE
        corte_id = _corte_registrado(sesion)
        _meta_con_rubro(sesion, corte_id, "000000001", "1000", "1000")
        sesion.commit()

        cuerpo = cliente.get("/api/v1/plan-accion/riesgo").json()

        assert cuerpo["filas"] == []
        assert cuerpo["total_en_riesgo"] == 0

    def test_sin_ningun_corte_registrado_devuelve_404(self, cliente) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _VISITANTE

        assert cliente.get("/api/v1/plan-accion/riesgo").status_code == 404

    def test_el_rol_gestor_no_tiene_acceso(self, cliente) -> None:
        """Mismo permiso que el resto del Plan de Acción (administradora y
        alcalde/visitante)."""
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _GESTOR

        assert cliente.get("/api/v1/plan-accion/riesgo").status_code == 403
