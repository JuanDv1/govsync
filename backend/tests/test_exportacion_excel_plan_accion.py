"""Pruebas de la construcción del archivo .xlsx del Plan de Acción.

CUBRE: [E04-HU03] HU03-CA01, CA03, CA04, CA05, CA06 -- ver docstring de
`app/modules/plan_accion/persistence/exportacion_excel.py`.

Puras: no abren sesión ni usan FastAPI -- solo openpyxl + los dataclasses
de dominio, igual criterio que `test_dominio_plan_accion.py`.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory

from openpyxl import load_workbook

from app.modules.plan_accion.domain.entidades import (
    EstadoCruceMeta,
    FilaPlanAccion,
    ResumenPlanAccion,
)
from app.modules.plan_accion.persistence.exportacion_excel import (
    MetadatosExportacion,
    _sanear_texto_celda,
    construir_libro_excel,
    construir_nombre_archivo,
)


def _fila(
    cod="040110500",
    sector="Educación",
    nombre="Vías pavimentadas",
    rubros=("nivel-1",),
    contratos=("C-001",),
    presupuesto=Decimal("1000000"),
    ejecucion=Decimal("500000"),
    avance_fin=Decimal("50.0"),
    estado=EstadoCruceMeta.COMPLETO,
) -> FilaPlanAccion:
    return FilaPlanAccion(
        cod_indicador_producto=cod,
        nombre_producto=nombre,
        sector=sector,
        meta_programada=Decimal("100"),
        cod_bpin="2024000010001",
        rubros=rubros,
        presupuesto_definitivo=presupuesto,
        ejecucion=ejecucion,
        contratos=contratos,
        avance_fisico_pct=None,
        avance_financiero_pct=avance_fin,
        estado_cruce=estado,
    )


def _metadatos(**overrides) -> MetadatosExportacion:
    base = {
        "vigencia": 2026,
        "fecha_corte": date(2026, 9, 30),
        "filtros_aplicados": "Ninguno",
        "usuario_correo": "admin@test.com",
        "generado_en": datetime(2026, 10, 14, 12, 0, 0),
    }
    base.update(overrides)
    return MetadatosExportacion(**base)


class TestConstruirNombreArchivo:
    def test_usa_fecha_del_corte_no_de_hoy_ca05(self):
        nombre = construir_nombre_archivo(2026, date(2026, 9, 30))

        assert nombre == "Plan_Accion_2026_Corte_2026-09-30.xlsx"


class TestConstruirLibroExcel:
    def _cargar_hoja(self, libro):
        with TemporaryDirectory() as tmp_dir:
            buffer_path = Path(tmp_dir) / "_plan_accion_test.xlsx"
            libro.save(buffer_path)
            return load_workbook(buffer_path)["Plan de Acción"]

    def test_encabezado_de_columnas_ca03(self):
        libro = construir_libro_excel([_fila()], ResumenPlanAccion(1, 1, 0, 0), _metadatos())
        hoja = self._cargar_hoja(libro)

        encabezados = [c.value for c in hoja[7]]
        assert encabezados[0] == "Sector"
        assert encabezados[1] == "Código Indicador"
        assert encabezados[-1] == "Estado de Cruce"

    def test_propiedades_de_formato_ca03(self):
        libro = construir_libro_excel(
            [
                _fila(cod="040110500", presupuesto=Decimal("1000000")),
                _fila(cod="170202300", presupuesto=Decimal("2000000")),
            ],
            ResumenPlanAccion(2, 2, 0, 0),
            _metadatos(),
        )
        hoja = self._cargar_hoja(libro)

        # Encabezado fijo: la fila de datos permanece visible al desplazarse.
        assert hoja.freeze_panes == "A8"

        # Autofiltro aplicado al encabezado y a las filas de datos.
        assert hoja.auto_filter.ref == "A7:L9"

        # Los valores numéricos permanecen como números, no como texto.
        assert isinstance(hoja.cell(row=8, column=4).value, (int, float, Decimal))
        assert isinstance(hoja.cell(row=8, column=7).value, (int, float, Decimal))

        # CA03: las filas de datos alternan el relleno.
        assert hoja.cell(row=8, column=1).fill.fill_type is None
        assert hoja.cell(row=9, column=1).fill.fill_type == "solid"

    def test_fila_de_datos_tiene_los_valores_de_la_meta_ca01(self):
        libro = construir_libro_excel(
            [_fila(cod="040110500")], ResumenPlanAccion(1, 1, 0, 0), _metadatos()
        )
        hoja = self._cargar_hoja(libro)

        fila = [c.value for c in hoja[8]]
        assert fila[1] == "040110500"
        assert fila[0] == "Educación"
        assert fila[-1] == "completo"

    def test_rubros_y_contratos_se_unen_con_coma(self):
        libro = construir_libro_excel(
            [_fila(rubros=("r1", "r2"), contratos=("c1", "c2"))],
            ResumenPlanAccion(1, 1, 0, 0),
            _metadatos(),
        )
        hoja = self._cargar_hoja(libro)

        fila = [c.value for c in hoja[8]]
        assert fila[5] == "r1, r2"
        assert fila[8] == "c1, c2"

    def test_avance_fisico_siempre_vacio_ca_e03_pendiente(self):
        libro = construir_libro_excel([_fila()], ResumenPlanAccion(1, 1, 0, 0), _metadatos())
        hoja = self._cargar_hoja(libro)

        fila = [c.value for c in hoja[8]]
        assert fila[9] is None

    def test_metadatos_en_la_cabecera_ca04(self):
        libro = construir_libro_excel(
            [_fila()],
            ResumenPlanAccion(1, 1, 0, 0),
            _metadatos(
                vigencia=2026,
                usuario_correo="alcalde@test.com",
                filtros_aplicados="Sector: Educación",
            ),
        )
        hoja = self._cargar_hoja(libro)

        texto_completo = "\n".join(str(hoja.cell(row=i, column=1).value) for i in range(1, 7))
        assert "2026" in texto_completo
        assert "alcalde@test.com" in texto_completo
        assert "Sector: Educación" in texto_completo

    def test_resumen_en_metadatos_coincide_con_pantalla_ca06(self):
        libro = construir_libro_excel(
            [_fila(), _fila(cod="170202300", estado=EstadoCruceMeta.PARCIAL)],
            ResumenPlanAccion(total=2, completo=1, parcial=1, sin_informacion=0),
            _metadatos(),
        )
        hoja = self._cargar_hoja(libro)

        texto_completo = "\n".join(str(hoja.cell(row=i, column=1).value) for i in range(1, 7))
        assert "2 metas" in texto_completo
        assert "Completo: 1" in texto_completo
        assert "Parcial: 1" in texto_completo

    def test_lista_vacia_no_falla_y_deja_solo_encabezado(self):
        libro = construir_libro_excel([], ResumenPlanAccion(0, 0, 0, 0), _metadatos())
        hoja = self._cargar_hoja(libro)

        assert hoja.cell(row=7, column=1).value == "Sector"
        assert hoja.cell(row=8, column=1).value is None

    def test_formato_pesos_en_presupuesto_y_ejecucion(self):
        libro = construir_libro_excel([_fila()], ResumenPlanAccion(1, 1, 0, 0), _metadatos())
        hoja = self._cargar_hoja(libro)

        assert "COP" in hoja.cell(row=8, column=7).number_format
        assert "COP" in hoja.cell(row=8, column=8).number_format

    def test_formato_porcentaje_no_duplica_escala_ca06(self):
        """El valor numérico debe seguir siendo 50.0 (no 0.5): CA06 exige
        que coincida con la pantalla, que ya muestra "50.0%", no "0.5%"."""
        libro = construir_libro_excel(
            [_fila(avance_fin=Decimal("50.0"))], ResumenPlanAccion(1, 1, 0, 0), _metadatos()
        )
        hoja = self._cargar_hoja(libro)

        celda = hoja.cell(row=8, column=11)
        assert celda.value == Decimal("50.0")
        assert "%" in celda.number_format


class TestSaneoDeFormulasEnCeldas:
    """[SEGURIDAD] Revisión de Juan David sobre el PR #154 (2026-10-18):
    `sector`/`nombre_producto` vienen del Excel que sube la administradora y
    se escribían sin sanear -- un texto que empiece por "=" se guarda como
    fórmula ("inyección de fórmulas"/CSV injection, OWASP)."""

    def test_sanear_antepone_comilla_a_texto_que_empieza_con_igual(self):
        assert _sanear_texto_celda("=SUM(A1:A9)") == "'=SUM(A1:A9)"

    def test_sanear_antepone_comilla_a_cada_prefijo_de_formula(self):
        for prefijo in ("=", "+", "-", "@", "\t", "\r"):
            texto = f"{prefijo}cmd|' /C calc'!A1"
            assert _sanear_texto_celda(texto) == f"'{texto}"

    def test_sanear_no_altera_texto_normal(self):
        assert _sanear_texto_celda("Infraestructura") == "Infraestructura"

    def test_sanear_no_falla_con_none(self):
        assert _sanear_texto_celda(None) is None

    def test_construir_libro_excel_sanea_sector_y_nombre_producto(self):
        libro = construir_libro_excel(
            [_fila(sector="=1+1", nombre='+HYPERLINK("http://x")')],
            ResumenPlanAccion(1, 1, 0, 0),
            _metadatos(),
        )
        with TemporaryDirectory() as tmp_dir:
            buffer_path = Path(tmp_dir) / "_plan_accion_test_saneo.xlsx"
            libro.save(buffer_path)
            hoja = load_workbook(buffer_path)["Plan de Acción"]

        fila = [c.value for c in hoja[8]]
        assert fila[0] == "'=1+1"
        assert fila[2] == '\'+HYPERLINK("http://x")'
