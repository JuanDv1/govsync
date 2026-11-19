# Conciliación CA08 con datos reales de Santa Rosa (parcial)

Tarjeta Trello: **[E-04/HU-01] TEST - Conciliación CA08 con archivo de referencia de la clienta**.
Fecha de la verificación: 2026-11-18. Ejecutada por QA asistido por IA (`[IA-ASISTIDO]`).

## Alcance y límite (leer primero)

Esto es una conciliación **interna**: contrasta lo que devuelve el backend contra un cálculo
independiente hecho en pandas sobre los **mismos archivos fuente**. **No** es el contraste con un
reporte de referencia de la clienta con resultados conocidos (ítems 1 y 2 de la tarjeta): ese
reporte no está en el repositorio ni en los archivos del proyecto (la hoja `Semaforo PPTO` del
archivo `Seguimiento Agosto 2026.xlsx` no trae valores guardados). Por eso **CA08 no se cierra**:
queda pendiente pedirle a la clienta el reporte (ver "Pendiente").

## Datos

- Plan Indicativo: `Plan indicativo PDT 19701 20260814T214948 SISPT.xlsx` (144 metas).
- Ejecución y contratación: `Formato Resumido_EJECUCION_202607.xlsx` (corte de **julio**, 224 filas de
  ejecución y 208 de contratación reconocidas).
- Proyectos: `Proyectos 2026.xlsx` (109 filas).
- Se cargaron por la API (`POST /cortes`, `/archivos/{PDT|EJECUCION|PROYECTOS}`, `/registrar`) con
  fecha de corte 2026-08-14 en una base SQLite, y se consultó `GET /plan-accion/actual` y
  `GET /registros-no-relacionados/{corte}`.
- **Supuesto sin confirmar:** la ejecución es de julio y el PDT del 14 de agosto; no se verificó con
  el equipo que sean un corte coherente. No cambia el resultado de la conciliación interna.

## Oráculo independiente

Por código de indicador (9 dígitos, con ceros a la izquierda): suma de `ApropiacionDefinitiva` y de
`OrdenPagoAcumulado` de las filas con `UltimoNivel = True`, sin indicador vacío.

## Resultado

| Comprobación                                            | Resultado                                   |
| ------------------------------------------------------- | ------------------------------------------- |
| Metas en el Plan de Acción                              | 144 (coincide con el PDT)                   |
| Presupuesto definitivo y ejecución por meta vs. oráculo | **144 de 144 coinciden** (0 diferencias)    |
| Avance financiero % = ejecución / presupuesto           | 0 inconsistencias                           |
| Metas con presupuesto o ejecución nulos                 | 25 (= las 25 `meta_sin_ejecucion` de HU-05) |
| Diferencia de total (oráculo − Plan de Acción)          | $ 13.190.000                                |

La diferencia de $ 13.190.000 es exactamente el rubro del indicador `350204600`, que está en la
ejecución pero no existe en el PDT. El Plan de Acción no lo cuenta (no hay meta) y **HU-05 lo
informa** como `rubro_indicador_no_existe_en_pdt` por el mismo valor: ambas pantallas cuadran.

HU-05 del mismo corte: total 189 = 181 del Plan Indicativo (79 sin contrato, 77 sin proyecto, 25 sin
ejecución) + 8 presupuestales (7 contrato con BPIN fuera de la plantilla, 1 indicador fuera del PDT).

## Pendiente para cerrar CA08

1. Pedirle a la clienta un reporte con resultados conocidos para un corte (vigencia, fecha de corte y
   archivos fuente).
2. Repetir esta comparación contra ese reporte y documentar las diferencias.
3. Confirmar que los 7 contratos con BPIN fuera de la plantilla sean un dato real de la fuente y no un
   problema de cruce.
