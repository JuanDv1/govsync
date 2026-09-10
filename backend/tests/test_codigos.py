"""Pruebas de los objetos de valor de códigos de dominio.

TARJETA: [TRANS-01] · CAPA: Dominio (kernel compartido)
CUBRE:
- normalización desde una celda de Excel (str, int, float, NaN, None)
- conservación de los ceros a la izquierda (código MGA de 9 dígitos)
- recuperación de UN cero perdido por Excel (8 -> 9), sin fabricar códigos cortos
- rechazo de identificadores SisPT ("IP-63") y de montos ("$ 1.218.264.452")
- inmutabilidad y comparación por valor (necesarias para el cruce de HU-07)
"""

from __future__ import annotations

import pytest

from app.shared.codigos import CodigoBpin, CodigoIndicadorProducto
from app.shared.errors import ReglaDeNegocioViolada


class TestCodigoIndicadorProducto:
    def test_acepta_nueve_digitos(self) -> None:
        assert CodigoIndicadorProducto("123456789").valor == "123456789"

    def test_conserva_el_cero_inicial(self) -> None:
        codigo = CodigoIndicadorProducto.desde_crudo("040110500")
        assert codigo is not None
        assert codigo.valor == "040110500"

    def test_recupera_un_cero_perdido_desde_texto(self) -> None:
        codigo = CodigoIndicadorProducto.desde_crudo("40110500")
        assert codigo is not None
        assert codigo.valor == "040110500"

    def test_recupera_un_cero_perdido_desde_entero(self) -> None:
        codigo = CodigoIndicadorProducto.desde_crudo(40110500)
        assert codigo is not None
        assert codigo.valor == "040110500"

    def test_recupera_un_cero_perdido_desde_float_entero(self) -> None:
        codigo = CodigoIndicadorProducto.desde_crudo(40110500.0)
        assert codigo is not None
        assert codigo.valor == "040110500"

    def test_rechaza_numero_corto_no_fabrica_un_codigo(self) -> None:
        assert CodigoIndicadorProducto.desde_crudo("12345") is None

    def test_rechaza_identificador_sistp(self) -> None:
        assert CodigoIndicadorProducto.desde_crudo("IP-63") is None

    def test_rechaza_un_monto(self) -> None:
        assert CodigoIndicadorProducto.desde_crudo("$ 1.218.264.452") is None

    def test_rechaza_mas_de_nueve_digitos(self) -> None:
        assert CodigoIndicadorProducto.desde_crudo("1234567890") is None

    @pytest.mark.parametrize(
        "vacio",
        [None, "", "   ", float("nan"), True, 40110500.5, object()],
    )
    def test_rechaza_valores_no_normalizables(self, vacio: object) -> None:
        assert CodigoIndicadorProducto.desde_crudo(vacio) is None

    def test_construccion_directa_es_estricta(self) -> None:
        # desde_crudo tolera 8 -> 9; el constructor no. Blinda la invariante.
        with pytest.raises(ReglaDeNegocioViolada):
            CodigoIndicadorProducto("40110500")

    def test_es_inmutable(self) -> None:
        codigo = CodigoIndicadorProducto("040110500")
        with pytest.raises(AttributeError):
            codigo.valor = "999999999"  # type: ignore[misc]

    def test_compara_y_hashea_por_valor(self) -> None:
        directo = CodigoIndicadorProducto("040110500")
        normalizado = CodigoIndicadorProducto.desde_crudo("40110500")
        assert directo == normalizado
        assert len({directo, normalizado}) == 1

    def test_extraer_todos_esta_fuera_del_alcance_de_trans_01(self) -> None:
        # [HU-04][BE-03]: la separación multivalor se implementa en la Fase 3.
        with pytest.raises(NotImplementedError):
            CodigoIndicadorProducto.extraer_todos("459903100")


class TestCodigoBpin:
    def test_acepta_quince_digitos(self) -> None:
        codigo = CodigoBpin.desde_crudo("202400000002842")
        assert codigo is not None
        assert codigo.valor == "202400000002842"

    @pytest.mark.parametrize(
        "invalido",
        ["20240000000284", "2024000000028420", "IP-1", "", None, float("nan")],
    )
    def test_rechaza_longitud_distinta_de_quince(self, invalido: object) -> None:
        assert CodigoBpin.desde_crudo(invalido) is None

    def test_construccion_directa_es_estricta(self) -> None:
        with pytest.raises(ReglaDeNegocioViolada):
            CodigoBpin("123")
