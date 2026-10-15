"""Construcción del archivo .xlsx del Plan de Acción Consolidado.

CAPA: Persistencia -- depende de `openpyxl`, mismo criterio que
`ingesta/persistence/lectores` (el dominio no conoce ninguna librería de
Excel; esta función solo TRADUCE `list[FilaPlanAccion]`/`ResumenPlanAccion`
ya agregados y filtrados a un `openpyxl.Workbook`, no recalcula nada).
TARJETA: [E04-HU03] Exportar el Plan de Acción Consolidado a Excel
CUBRE: HU03-CA01 (exportar todo), CA02 (exportar ya filtrado -- las `filas`
que recibe esta función son las que el router ya filtró con
`filtrar_plan_accion`, igual que CA06/HU01), CA03 (formato), CA04
(metadatos), CA05 (nombre de archivo), CA06 (mismos valores que la
respuesta JSON -- las 12 columnas son EXACTAMENTE las de
`FilaPlanAccionRespuesta`, no las "14 columnas" ambiguas que D26 punto 5
dejó sin resolver para CA02 de HU-01).

QUÉ NO CUBRE: CA07 (botón deshabilitado sin resultados) es 100% frontend.
CA08 (mensaje genérico si falla la generación) no necesita manejo propio
aquí: cualquier excepción no prevista ya cae en el manejador global de
`app/core/errores.py` (`_manejar_error_no_previsto`), que responde 500 con
mensaje genérico sin exponer la traza -- exactamente lo que pide CA08, sin
duplicar ese try/except en esta tarjeta.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.worksheet import Worksheet

from app.modules.plan_accion.domain.entidades import FilaPlanAccion, ResumenPlanAccion

#: CA03: "filas alternas" -- relleno de las filas de datos pares (1-indexado
#: desde la primera fila de datos, no desde la hoja completa).
_RELLENO_FILA_ALTERNA = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
_FUENTE_ENCABEZADO = Font(bold=True)
_RELLENO_ENCABEZADO = PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid")

#: CA03: "formato de pesos" -- separador de miles, sin decimales (mismo
#: criterio que el resto del proyecto para DINERO, ver `shared`/modelos:
#: los montos del PDT/Ejecución no traen centavos significativos).
_FORMATO_PESOS = '#,##0 "COP"'
#: CA03: "formato de ... %" -- el dominio ya expresa `avance_financiero_pct`
#: en escala 0-100 (ej. 45.2), no como fracción 0-1: se escribe el valor TAL
#: CUAL y se le agrega el símbolo "%" como texto del formato (NO se usa el
#: formato nativo `0.0%` de Excel, que multiplicaría por 100 otra vez y
#: rompería CA06 -- "cifras idénticas a pantalla").
_FORMATO_PORCENTAJE = '0.0"%"'

_ENCABEZADOS = (
    "Sector",
    "Código Indicador",
    "Producto",
    "Meta Programada",
    "BPIN",
    "Rubros",
    "Presupuesto Definitivo",
    "Ejecución",
    "Contratos",
    "% Avance Físico",
    "% Avance Financiero",
    "Estado de Cruce",
)

#: Fila donde empieza el bloque de metadatos (CA04, incluye el resumen de
#: CA06); el encabezado de columnas (CA03: "encabezado fijo") va 2 filas
#: después del bloque, dejando una fila en blanco de separación.
_FILA_METADATOS_INICIO = 1
_FILA_ENCABEZADO = 7


@dataclass(frozen=True, slots=True)
class MetadatosExportacion:
    """CA04: metadatos del reporte, para la cabecera del archivo."""

    vigencia: int
    fecha_corte: date
    filtros_aplicados: str
    usuario_correo: str
    generado_en: datetime


def construir_nombre_archivo(vigencia: int, fecha_corte: date) -> str:
    """CA05: ``Plan_Accion_<vigencia>_Corte_<AAAA-MM-DD>.xlsx`` -- la fecha
    es la del CORTE, no la de la descarga (el Excel de requisitos marca
    esta convención como "[VALIDAR]"; se implementa tal cual como SUPUESTO
    MENOR hasta que el equipo diga lo contrario -- no afecta esquema,
    dinero ni seguridad)."""
    return f"Plan_Accion_{vigencia}_Corte_{fecha_corte.isoformat()}.xlsx"


def _escribir_metadatos(
    hoja: Worksheet, metadatos: MetadatosExportacion, resumen: ResumenPlanAccion
) -> None:
    filas_metadatos = (
        "Plan de Acción Consolidado",
        f"Vigencia: {metadatos.vigencia}    Corte: {metadatos.fecha_corte.isoformat()}",
        f"Filtros aplicados: {metadatos.filtros_aplicados}",
        f"Generado por: {metadatos.usuario_correo}",
        f"Fecha y hora de generación: {metadatos.generado_en.isoformat(timespec='seconds')}",
        # CA06: mismo resumen que la respuesta JSON (`ResumenPlanAccionRespuesta`),
        # sobre las filas YA filtradas -- para que coincida con lo que el
        # usuario ve en pantalla al momento de exportar.
        f"Resumen: {resumen.total} metas -- Completo: {resumen.completo}, "
        f"Parcial: {resumen.parcial}, Sin información: {resumen.sin_informacion}",
    )
    for indice, texto in enumerate(filas_metadatos):
        hoja.cell(row=_FILA_METADATOS_INICIO + indice, column=1, value=texto)
    hoja.cell(row=_FILA_METADATOS_INICIO, column=1).font = Font(bold=True, size=13)


def _escribir_encabezado(hoja: Worksheet) -> None:
    for columna, titulo in enumerate(_ENCABEZADOS, start=1):
        celda = hoja.cell(row=_FILA_ENCABEZADO, column=columna, value=titulo)
        celda.font = _FUENTE_ENCABEZADO
        celda.fill = _RELLENO_ENCABEZADO
        celda.alignment = Alignment(horizontal="center", wrap_text=True)


def _escribir_fila(hoja: Worksheet, fila_excel: int, fila: FilaPlanAccion) -> None:
    valores = (
        fila.sector,
        fila.cod_indicador_producto,
        fila.nombre_producto,
        fila.meta_programada,
        fila.cod_bpin,
        ", ".join(fila.rubros) if fila.rubros else None,
        fila.presupuesto_definitivo,
        fila.ejecucion,
        ", ".join(fila.contratos) if fila.contratos else None,
        fila.avance_fisico_pct,  # CA: siempre None hasta que exista E-03
        fila.avance_financiero_pct,
        fila.estado_cruce.value,
    )
    for columna, valor in enumerate(valores, start=1):
        celda = hoja.cell(row=fila_excel, column=columna, value=valor)
        if columna in (7, 8):  # Presupuesto Definitivo, Ejecución
            celda.number_format = _FORMATO_PESOS
        elif columna == 11:  # % Avance Financiero
            celda.number_format = _FORMATO_PORCENTAJE

    if (fila_excel - _FILA_ENCABEZADO) % 2 == 0:
        for columna in range(1, len(_ENCABEZADOS) + 1):
            hoja.cell(row=fila_excel, column=columna).fill = _RELLENO_FILA_ALTERNA


def construir_libro_excel(
    filas: list[FilaPlanAccion],
    resumen: ResumenPlanAccion,
    metadatos: MetadatosExportacion,
) -> Workbook:
    """CA01/CA02/CA03/CA04/CA06. `filas` ya viene agregada por meta Y
    filtrada (CA02) por quien llama -- esta función no filtra ni agrega,
    solo serializa, para no duplicar esa regla (ya está en
    `domain.entidades.filtrar_plan_accion`)."""
    libro = Workbook()
    hoja = libro.active
    hoja.title = "Plan de Acción"

    _escribir_metadatos(hoja, metadatos, resumen)
    _escribir_encabezado(hoja)

    ultima_fila = _FILA_ENCABEZADO
    for desplazamiento, fila in enumerate(filas):
        ultima_fila = _FILA_ENCABEZADO + 1 + desplazamiento
        _escribir_fila(hoja, ultima_fila, fila)

    # CA03: "encabezado fijo con autofiltro".
    hoja.freeze_panes = f"A{_FILA_ENCABEZADO + 1}"
    hoja.auto_filter.ref = f"A{_FILA_ENCABEZADO}:L{ultima_fila}"

    for columna in range(1, len(_ENCABEZADOS) + 1):
        letra = hoja.cell(row=_FILA_ENCABEZADO, column=columna).column_letter
        hoja.column_dimensions[letra].width = 20

    return libro
