"""Excel de los registros no relacionados de un corte.

CAPA: Persistencia (depende de `openpyxl`).
TARJETA: [E-04/HU-05] BE. CUBRE: HU05-CA07 (exportar respetando filtros) y
la mitad "filas exportadas" de CA05: esta función recibe las filas YA
filtradas y ordenadas por el dominio y no filtra ni recalcula nada, así que
el número de filas del archivo es el mismo `total` de la respuesta JSON.

Mismo estilo que el Excel del Plan de Acción (encabezado fijo con
autofiltro, filas alternas, pesos con separador de miles). Los textos
vienen de los archivos que sube la administradora: se escriben con
`sanear_texto_celda` (inyección de fórmulas).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from app.modules.alertas.domain.registros_no_relacionados import (
    ETIQUETAS_FUENTE,
    ETIQUETAS_MOTIVO,
    Fuente,
    RegistroNoRelacionado,
)
from app.shared.persistence.excel_seguro import sanear_texto_celda

_ENCABEZADOS = ("Fuente", "Código", "Descripción", "Valor", "Motivo")
_ANCHOS = (18, 28, 60, 20, 50)
_FILA_ENCABEZADO = 7
_FORMATO_PESOS = '#,##0 "COP"'
_RELLENO_FILA_ALTERNA = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
_RELLENO_ENCABEZADO = PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid")


@dataclass(frozen=True, slots=True)
class MetadatosExportacionNoRelacionados:
    vigencia: int
    fecha_corte: date
    filtros_aplicados: str
    usuario_correo: str
    generado_en: datetime


def construir_nombre_archivo(vigencia: int, fecha_corte: date) -> str:
    """Misma convención que el Plan de Acción: la fecha es la del corte."""
    return f"No_Relacionados_{vigencia}_Corte_{fecha_corte.isoformat()}.xlsx"


def construir_libro_no_relacionados(
    filas: list[RegistroNoRelacionado],
    conteos_por_fuente: dict[Fuente, int],
    metadatos: MetadatosExportacionNoRelacionados,
) -> Workbook:
    libro = Workbook()
    hoja = libro.active
    hoja.title = "No relacionados"

    conteos = ", ".join(
        f"{ETIQUETAS_FUENTE[fuente]}: {cantidad}" for fuente, cantidad in conteos_por_fuente.items()
    )
    metadatos_texto = (
        "Registros no relacionados",
        f"Vigencia: {metadatos.vigencia}    Corte: {metadatos.fecha_corte.isoformat()}",
        f"Filtros aplicados: {metadatos.filtros_aplicados}",
        f"Generado por: {metadatos.usuario_correo}",
        f"Fecha y hora de generación: {metadatos.generado_en.isoformat(timespec='seconds')}",
        f"Total: {len(filas)} -- {conteos}",
    )
    for indice, texto in enumerate(metadatos_texto, start=1):
        hoja.cell(row=indice, column=1, value=texto)
    hoja.cell(row=1, column=1).font = Font(bold=True, size=13)

    for columna, (titulo, ancho) in enumerate(zip(_ENCABEZADOS, _ANCHOS, strict=True), start=1):
        celda = hoja.cell(row=_FILA_ENCABEZADO, column=columna, value=titulo)
        celda.font = Font(bold=True)
        celda.fill = _RELLENO_ENCABEZADO
        celda.alignment = Alignment(horizontal="center")
        hoja.column_dimensions[celda.column_letter].width = ancho

    ultima_fila = _FILA_ENCABEZADO
    for desplazamiento, registro in enumerate(filas, start=1):
        ultima_fila = _FILA_ENCABEZADO + desplazamiento
        valores = (
            ETIQUETAS_FUENTE[registro.fuente],
            sanear_texto_celda(registro.codigo),
            sanear_texto_celda(registro.descripcion),
            registro.valor,
            ETIQUETAS_MOTIVO[registro.motivo],
        )
        for columna, valor in enumerate(valores, start=1):
            celda = hoja.cell(row=ultima_fila, column=columna, value=valor)
            if columna == 4:
                celda.number_format = _FORMATO_PESOS
            if desplazamiento % 2 == 0:
                celda.fill = _RELLENO_FILA_ALTERNA

    hoja.freeze_panes = f"A{_FILA_ENCABEZADO + 1}"
    hoja.auto_filter.ref = f"A{_FILA_ENCABEZADO}:E{ultima_fila}"
    return libro
