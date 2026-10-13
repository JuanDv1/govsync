"""Pruebas del dominio de Plan de Acción Consolidado (agregación por meta).

CUBRE: HU01-CA02, CA03, CA05, CA08 -- ver docs/DECISIONES.md D26 y el
docstring de `app/modules/plan_accion/domain/entidades.py`.

Son pruebas puras: sin FastAPI, sin SQLAlchemy, sin sesión -- exactamente
lo que la regla de arquitectura exige para el dominio (test_arquitectura.py).
"""

from __future__ import annotations

from decimal import Decimal

from app.modules.plan_accion.domain.entidades import (
    EstadoCruceMeta,
    FilaFuenteMeta,
    agregar_por_meta,
    calcular_resumen,
)


def _fila(
    cod="000000001",
    nombre_producto="Producto X",
    sector="Educación",
    meta_cuatrienio=Decimal("100"),
    cod_bpin="2024000010001",
    codigo_rubro=None,
    presupuesto=None,
    ejecucion=None,
    contrato=None,
) -> FilaFuenteMeta:
    return FilaFuenteMeta(
        cod_indicador_producto=cod,
        nombre_producto=nombre_producto,
        sector=sector,
        meta_cuatrienio=meta_cuatrienio,
        cod_bpin=cod_bpin,
        codigo_rubro=codigo_rubro,
        presupuesto_apropiado=presupuesto,
        ejecucion=ejecucion,
        numero_contrato=contrato,
    )


class TestAgregarPorMetaUnaFilaPorMeta:
    """CA03: "sin duplicar los valores de la meta en los totales"."""

    def test_una_meta_con_tres_filas_crudas_produce_una_sola_fila_agregada(self):
        filas = [
            _fila(codigo_rubro="R1", presupuesto=Decimal("1000"), contrato="C1"),
            _fila(codigo_rubro="R1", presupuesto=Decimal("1000"), contrato="C2"),
            _fila(codigo_rubro="R1", presupuesto=Decimal("1000"), contrato="C3"),
        ]

        resultado = agregar_por_meta(filas)

        assert len(resultado) == 1
        assert resultado[0].contratos == ("C1", "C2", "C3")

    def test_metas_distintas_producen_filas_distintas(self):
        filas = [_fila(cod="000000001"), _fila(cod="000000002")]

        resultado = agregar_por_meta(filas)

        assert {f.cod_indicador_producto for f in resultado} == {"000000001", "000000002"}
        # Orden estable (CA02: tabla consolidada) -- por código ascendente.
        assert [f.cod_indicador_producto for f in resultado] == ["000000001", "000000002"]


class TestAgregarPorMetaSinDuplicarDinero:
    """CA08: el fan-out de 1 rubro -> N contratos NO debe sumarse N veces.

    Escenario real documentado en trazabilidad/persistence/consultas.py:
    un rubro vinculado a 3 contratos produce 3 filas crudas con el MISMO
    presupuesto/ejecución repetido -- `agregar_por_meta` debe sumarlo UNA
    sola vez, deduplicando por `codigo_rubro`, nunca por fila.
    """

    def test_un_rubro_con_tres_contratos_no_triplica_el_presupuesto(self):
        filas = [
            _fila(
                codigo_rubro="R1",
                presupuesto=Decimal("5000"),
                ejecucion=Decimal("2000"),
                contrato=c,
            )
            for c in ("C1", "C2", "C3")
        ]

        resultado = agregar_por_meta(filas)

        assert len(resultado) == 1
        assert resultado[0].presupuesto_definitivo == Decimal("5000")
        assert resultado[0].ejecucion == Decimal("2000")
        assert resultado[0].contratos == ("C1", "C2", "C3")

    def test_dos_rubros_distintos_de_la_misma_meta_si_se_suman(self):
        filas = [
            _fila(codigo_rubro="R1", presupuesto=Decimal("1000"), ejecucion=Decimal("100")),
            _fila(codigo_rubro="R2", presupuesto=Decimal("2000"), ejecucion=Decimal("300")),
        ]

        resultado = agregar_por_meta(filas)

        assert resultado[0].presupuesto_definitivo == Decimal("3000")
        assert resultado[0].ejecucion == Decimal("400")
        assert resultado[0].rubros == ("R1", "R2")


class TestAgregarPorMetaCamposNulosExplicitos:
    """CA06/CA-8 (heredado de HU-07): sin rubro/contrato, los totales deben
    ser `None`, nunca `Decimal(0)` -- distinguir "no hay dato" de "el dato
    es cero" (CA06: resaltar celdas vacías con leyenda, imposible si un
    0 inventado se confunde con un 0 real)."""

    def test_meta_sin_ningun_rubro_tiene_totales_en_none_no_en_cero(self):
        filas = [_fila(codigo_rubro=None, presupuesto=None, ejecucion=None, contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].presupuesto_definitivo is None
        assert resultado[0].ejecucion is None
        assert resultado[0].rubros == ()
        assert resultado[0].contratos == ()
        assert resultado[0].avance_financiero_pct is None

    def test_avance_fisico_siempre_es_none_sin_implementacion_de_e03(self):
        resultado = agregar_por_meta([_fila(codigo_rubro="R1", presupuesto=Decimal("100"))])

        assert resultado[0].avance_fisico_pct is None


class TestAgregarPorMetaAvanceFinanciero:
    def test_calcula_porcentaje_cuando_hay_presupuesto_y_ejecucion(self):
        filas = [_fila(codigo_rubro="R1", presupuesto=Decimal("200"), ejecucion=Decimal("50"))]

        resultado = agregar_por_meta(filas)

        assert resultado[0].avance_financiero_pct == Decimal("25")

    def test_no_divide_por_cero_cuando_el_presupuesto_es_cero(self):
        filas = [_fila(codigo_rubro="R1", presupuesto=Decimal("0"), ejecucion=Decimal("0"))]

        resultado = agregar_por_meta(filas)

        assert resultado[0].avance_financiero_pct is None


class TestAgregarPorMetaEstadoCruce:
    """CA05: "Completo = la meta relacionó PDT, presupuesto y BPIN; Parcial
    = falta al menos una relación; Sin información = solo existe en el
    PDT" -- texto literal del CA, no una definición inventada."""

    def test_meta_con_bpin_rubro_y_contrato_es_completo(self):
        filas = [_fila(cod_bpin="2024000010001", codigo_rubro="R1", contrato="C1")]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.COMPLETO

    def test_meta_sin_bpin_ni_rubro_ni_contrato_es_sin_informacion(self):
        filas = [_fila(cod_bpin=None, codigo_rubro=None, contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.SIN_INFORMACION

    def test_meta_con_bpin_pero_sin_rubro_es_parcial(self):
        filas = [_fila(cod_bpin="2024000010001", codigo_rubro=None, contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.PARCIAL

    def test_meta_con_rubro_pero_sin_bpin_ni_contrato_es_parcial(self):
        filas = [_fila(cod_bpin=None, codigo_rubro="R1", contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.PARCIAL

    def test_meta_con_todo_menos_contrato_es_parcial(self):
        filas = [_fila(cod_bpin="2024000010001", codigo_rubro="R1", contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.PARCIAL


class TestCalcularResumen:
    """CA05: pie de la tabla -- "Total: N | Completo: a | Parcial: b |
    Sin información: c"; invariante total == completo+parcial+sin_info."""

    def test_resumen_cuenta_cada_estado_y_cuadra_el_total(self):
        filas = agregar_por_meta(
            [
                _fila(cod="1", cod_bpin="b", codigo_rubro="r", contrato="c"),  # completo
                _fila(cod="2", cod_bpin="b", codigo_rubro=None, contrato=None),  # parcial
                _fila(cod="3", cod_bpin=None, codigo_rubro=None, contrato=None),  # sin_info
            ]
        )

        resumen = calcular_resumen(filas)

        assert resumen.total == 3
        assert resumen.completo == 1
        assert resumen.parcial == 1
        assert resumen.sin_informacion == 1
        assert resumen.total == resumen.completo + resumen.parcial + resumen.sin_informacion

    def test_resumen_de_lista_vacia_es_todo_cero(self):
        resumen = calcular_resumen([])

        assert resumen.total == 0
        assert resumen.completo == 0
        assert resumen.parcial == 0
        assert resumen.sin_informacion == 0
