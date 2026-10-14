# [E04-HU03] Exportar el Plan de Acción Consolidado a Excel

**Estado de la Specification:** Borrador

> Mientras esté en `Borrador`, la fuente de requisitos de esta HU es su hoja
> del Excel (`docs/requisitos/`, hoja `HU_E04_03`).

## Origen

Hoja `HU_E04_03` del Excel de levantamiento de requisitos
(`GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`).

## Historia

Como administradora y alcalde quiero exportar el Plan de Acción consolidado
a Excel para contar con un artefacto reutilizable y comparable con el
proceso manual.

## Alcance

- **Incluye (backend):** generar un archivo `.xlsx` a partir del mismo
  resultado (ya agregado y filtrado) que expone [E04-HU01]/[E04-HU02],
  con metadatos de trazabilidad en la cabecera.
- **Fuera de alcance:** deshabilitar el botón de exportar cuando no hay
  resultados (CA07) — 100% frontend, la ausencia de filas ya la informa
  `GET /actual`.

## Actores y permisos

Mismos que E04-HU01/HU02 (D26): `administrador` y `visitante`.

## Criterios de aceptación

| ID            | Escenario                   | Notas                                                                         |
| ------------- | --------------------------- | ----------------------------------------------------------------------------- |
| E04-HU03-CA01 | Exportar Plan completo      | `GET /exportar` sin query params                                              |
| E04-HU03-CA02 | Exportar con filtros        | Mismos query params que `GET /actual` (D27)                                   |
| E04-HU03-CA03 | Formato utilizable          | Encabezado fijo + autofiltro, números reales, formato pesos/%, filas alternas |
| E04-HU03-CA04 | Metadatos del reporte       | Vigencia, fecha de corte, filtros aplicados, usuario, fecha/hora — ver D28    |
| E04-HU03-CA05 | Nombre del archivo          | `Plan_Accion_<vigencia>_Corte_<AAAA-MM-DD>.xlsx` — SUPUESTO MENOR, ver D28    |
| E04-HU03-CA06 | Cifras idénticas a pantalla | Mismas `FilaPlanAccion`/`ResumenPlanAccion` que `GET /actual`, sin recalcular |
| E04-HU03-CA07 | Sin datos para exportar     | Fuera de alcance de esta tarjeta — 100% frontend                              |
| E04-HU03-CA08 | Error al generar            | Sin manejo propio — ya lo cubre el manejador global (`app/core/errores.py`)   |

## Reglas de negocio

- El archivo exportado NUNCA recalcula nada: serializa exactamente las
  `FilaPlanAccion`/`ResumenPlanAccion` que ya construyó/filtró el pipeline
  compartido con `GET /actual` (`_obtener_filas_filtradas`).
- Columnas exportadas = las 12 de `FilaPlanAccionRespuesta`, no las "14
  columnas" ambiguas de D26 punto 5 (ver D28).

## Contrato

- `GET /api/v1/plan-accion/exportar` — mismos query params que
  `GET /api/v1/plan-accion/actual` (`sector`, `estado_cruce`, `busqueda`,
  `cod_indicador_producto`). Respuesta: `200` con
  `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  y `Content-Disposition: attachment; filename="Plan_Accion_<vigencia>_Corte_<fecha>.xlsx"`.
  Mismo contrato de autenticación/errores que E04-HU01 (401/403/404/409).

## Decisiones aplicadas

- Ver [D28](../DECISIONES.md) para las columnas exportadas, la convención
  de nombre de archivo y el formato de porcentaje.
