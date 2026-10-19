"""Pruebas del dominio de comparación entre dos cortes (E04-HU04).

CUBRE: HU04-CA04, CA05, CA06, CA07 -- ver docstring de
`app/modules/plan_accion/domain/comparacion.py`.

Pruebas puras: construyen `FilaPlanAccion` directamente (sin BD, sin
`agregar_por_meta`) -- exactamente lo que exige test_arquitectura.py para
el dominio.
"""

from __future__ import annotations

from decimal import Decimal

from app.modules.plan_accion.domain.comparacion import (
    PresenciaMeta,
    comparar_cortes,
    filtrar_solo_cambios,
)
from app.modules.plan_accion.domain.entidades import EstadoCruceMeta, FilaPlanAccion


def _fila(
    cod="040110500",
    nombre_producto="Vías pavimentadas",
    sector="Infraestructura",
    ejecucion=None,
    avance_financiero_pct=None,
) -> FilaPlanAccion:
    return FilaPlanAccion(
        cod_indicador_producto=cod,
        nombre_producto=nombre_producto,
        sector=sector,
        meta_programada=None,
        cod_bpin=None,
        rubros=(),
        presupuesto_definitivo=None,
        ejecucion=ejecucion,
        contratos=(),
        avance_fisico_pct=None,
        avance_financiero_pct=avance_financiero_pct,
        estado_cruce=EstadoCruceMeta.SIN_INFORMACION,
    )


class TestCompararCortesCA04CA05:
    def test_meta_en_ambos_cortes_calcula_delta(self) -> None:
        filas_a = [_fila(ejecucion=Decimal("100"), avance_financiero_pct=Decimal("40"))]
        filas_b = [_fila(ejecucion=Decimal("150"), avance_financiero_pct=Decimal("55"))]

        resultado = comparar_cortes(filas_a, filas_b)

        assert len(resultado) == 1
        fila = resultado[0]
        assert fila.presencia is PresenciaMeta.AMBOS
        assert fila.ejecucion_a == Decimal("100")
        assert fila.ejecucion_b == Decimal("150")
        assert fila.ejecucion_delta == Decimal("50")
        assert fila.avance_financiero_delta == Decimal("15")

    def test_delta_es_b_menos_a_puede_ser_negativo(self) -> None:
        filas_a = [_fila(ejecucion=Decimal("150"))]
        filas_b = [_fila(ejecucion=Decimal("100"))]

        resultado = comparar_cortes(filas_a, filas_b)

        assert resultado[0].ejecucion_delta == Decimal("-50")

    def test_sin_cambio_el_delta_es_cero_no_none(self) -> None:
        filas_a = [_fila(ejecucion=Decimal("100"))]
        filas_b = [_fila(ejecucion=Decimal("100"))]

        resultado = comparar_cortes(filas_a, filas_b)

        assert resultado[0].ejecucion_delta == Decimal("0")

    def test_avance_fisico_siempre_none_e03_no_implementado(self) -> None:
        filas_a = [_fila()]
        filas_b = [_fila()]

        resultado = comparar_cortes(filas_a, filas_b)

        assert resultado[0].avance_fisico_pct_a is None
        assert resultado[0].avance_fisico_pct_b is None
        assert resultado[0].avance_fisico_delta is None


class TestCompararCortesCA06PresenciaParcial:
    def test_meta_solo_en_corte_a(self) -> None:
        filas_a = [_fila(cod="040110500", ejecucion=Decimal("100"))]
        filas_b: list[FilaPlanAccion] = []

        resultado = comparar_cortes(filas_a, filas_b)

        assert len(resultado) == 1
        assert resultado[0].presencia is PresenciaMeta.SOLO_CORTE_A
        assert resultado[0].ejecucion_a == Decimal("100")
        assert resultado[0].ejecucion_b is None
        assert resultado[0].ejecucion_delta is None  # None, no 0 -- no comparable

    def test_meta_solo_en_corte_b(self) -> None:
        filas_a: list[FilaPlanAccion] = []
        filas_b = [_fila(cod="170202300", ejecucion=Decimal("80"))]

        resultado = comparar_cortes(filas_a, filas_b)

        assert len(resultado) == 1
        assert resultado[0].presencia is PresenciaMeta.SOLO_CORTE_B
        assert resultado[0].ejecucion_a is None
        assert resultado[0].ejecucion_b == Decimal("80")

    def test_el_nombre_y_sector_vienen_de_la_fila_que_sí_existe(self) -> None:
        filas_a: list[FilaPlanAccion] = []
        filas_b = [_fila(cod="170202300", nombre_producto="Escuelas", sector="Educación")]

        resultado = comparar_cortes(filas_a, filas_b)

        assert resultado[0].nombre_producto == "Escuelas"
        assert resultado[0].sector == "Educación"

    def test_union_de_dos_cortes_sin_metas_en_comun(self) -> None:
        filas_a = [_fila(cod="040110500")]
        filas_b = [_fila(cod="170202300")]

        resultado = comparar_cortes(filas_a, filas_b)

        codigos = {f.cod_indicador_producto for f in resultado}
        assert codigos == {"040110500", "170202300"}

    def test_dos_cortes_vacios_devuelve_lista_vacia(self) -> None:
        assert comparar_cortes([], []) == []

    def test_resultado_ordenado_por_codigo(self) -> None:
        filas_a = [_fila(cod="900000001"), _fila(cod="040110500")]
        filas_b = [_fila(cod="900000001"), _fila(cod="040110500")]

        resultado = comparar_cortes(filas_a, filas_b)

        assert [f.cod_indicador_producto for f in resultado] == ["040110500", "900000001"]


class TestFiltrarSoloCambiosCA07:
    def test_oculta_meta_sin_ningun_cambio(self) -> None:
        filas_a = [_fila(ejecucion=Decimal("100"), avance_financiero_pct=Decimal("50"))]
        filas_b = [_fila(ejecucion=Decimal("100"), avance_financiero_pct=Decimal("50"))]
        comparadas = comparar_cortes(filas_a, filas_b)

        assert filtrar_solo_cambios(comparadas) == []

    def test_conserva_meta_con_cambio_de_ejecucion(self) -> None:
        filas_a = [_fila(ejecucion=Decimal("100"))]
        filas_b = [_fila(ejecucion=Decimal("150"))]
        comparadas = comparar_cortes(filas_a, filas_b)

        assert filtrar_solo_cambios(comparadas) == comparadas

    def test_conserva_meta_con_cambio_de_avance_financiero(self) -> None:
        filas_a = [_fila(ejecucion=Decimal("100"), avance_financiero_pct=Decimal("40"))]
        filas_b = [_fila(ejecucion=Decimal("100"), avance_financiero_pct=Decimal("45"))]
        comparadas = comparar_cortes(filas_a, filas_b)

        assert filtrar_solo_cambios(comparadas) == comparadas

    def test_meta_que_gana_el_cruce_de_ejecucion_no_se_oculta(self) -> None:
        """Bug encontrado en la revisión de Juan David sobre el PR #154
        (2026-10-18): `ejecucion_a=None -> ejecucion_b=100` es un cambio real
        (la meta gana el cruce presupuestal), aunque `ejecucion_delta` sea
        `None` por no ser comparable numéricamente."""
        filas_a = [_fila(ejecucion=None)]
        filas_b = [_fila(ejecucion=Decimal("100"))]
        comparadas = comparar_cortes(filas_a, filas_b)

        resultado = filtrar_solo_cambios(comparadas)

        assert len(resultado) == 1
        assert resultado[0].ejecucion_delta is None

    def test_meta_que_pierde_el_cruce_de_ejecucion_no_se_oculta(self) -> None:
        """Caso simétrico: `ejecucion_a=100 -> ejecucion_b=None` (la meta
        pierde el cruce presupuestal) tampoco debe ocultarse."""
        filas_a = [_fila(ejecucion=Decimal("100"))]
        filas_b = [_fila(ejecucion=None)]
        comparadas = comparar_cortes(filas_a, filas_b)

        resultado = filtrar_solo_cambios(comparadas)

        assert len(resultado) == 1
        assert resultado[0].ejecucion_delta is None

    def test_meta_que_gana_o_pierde_el_avance_financiero_no_se_oculta(self) -> None:
        """Mismo bug, columna de avance financiero en vez de ejecución."""
        filas_a = [_fila(avance_financiero_pct=Decimal("40"))]
        filas_b = [_fila(avance_financiero_pct=None)]
        comparadas = comparar_cortes(filas_a, filas_b)

        resultado = filtrar_solo_cambios(comparadas)

        assert len(resultado) == 1
        assert resultado[0].avance_financiero_delta is None

    def test_meta_solo_en_un_corte_nunca_se_oculta_aunque_no_tenga_delta(self) -> None:
        filas_a = [_fila(cod="040110500")]
        filas_b: list[FilaPlanAccion] = []
        comparadas = comparar_cortes(filas_a, filas_b)

        resultado = filtrar_solo_cambios(comparadas)

        assert len(resultado) == 1
        assert resultado[0].presencia is PresenciaMeta.SOLO_CORTE_A

    def test_lista_vacia_devuelve_lista_vacia(self) -> None:
        assert filtrar_solo_cambios([]) == []
