# [E02-HU10] Filtrar matriz de relación

**Estado de la Specification:** Borrador

> Spec retroactiva (2026-10-05): el backend (CA01-02, 04-09, 14, 16-17) ya
> está implementado y mergeado a `develop` (PR #131). Se escribe esta spec
> para ponerla al día con el proceso nuevo (`docs/PROCESO.md`). Queda en
> `Borrador` porque CA-03 (autocompletar como endpoint propio), CA-10 a
> CA-13 (etiquetas activas, "Limpiar filtros", persistencia al paginar) y el
> panel de filtros en sí son trabajo de frontend todavía pendiente, y CA-15
> trae un `[VALIDAR]` sin resolver — no por duda sobre el backend ya
> escrito.

## Origen

Hoja del Excel de levantamiento de requisitos (`docs/requisitos/GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`,
hoja «HU_E02_10» — fusiona las antiguas 10a/10b/10c/10d/10e). CA-16 y CA-17
se agregaron al alcance original tras validar contra
`TranscripcionReunion3Emilse.md` y `TranscripcionReunion5Emilse.md` (ver
Decisiones aplicadas) — no estaban en el Excel original, no son un supuesto
de la IA.

## Historia

Como administradora, quiero filtrar la matriz de relación del corte
seleccionado por BPIN, Indicador, Producto, Contrato, Sector y Programa,
combinando criterios, para aislar la información de un proyecto, indicador,
producto o contrato y su trazabilidad sin reconstruir el cruce manualmente.

## Alcance

- **Incluye (backend, ya implementado):** los 6 filtros combinables sobre
  `GET /matriz-relacion/{corte_id}` y `/actual`; el endpoint de opciones de
  filtro; `nombre_proyecto` en cada fila de la matriz.
- **Fuera de alcance de esta implementación (pendiente de frontend):** el
  panel de filtros en sí (CA-01), autocompletado como endpoint propio
  (CA-03 — se resuelve client-side, ver Decisiones aplicadas), etiquetas de
  filtros activos y su edición/remoción (CA-10), estado "sin resultados"
  (CA-11), "Limpiar filtros" (CA-12), persistencia de filtros al paginar u
  ordenar (CA-13).

## Actores y permisos

Administradora (según la historia). Sin restricción de rol definida en el
Excel para esta HU.

## Criterios de aceptación

| ID            | Escenario                                      | Dado                                                                 | Cuando                                                      | Entonces                                                                                                  | Tipo    | Notas |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------- | ----- |
| E02-HU10-CA01 | Panel de filtros                                | La matriz de relación de un corte está visible                        | selecciona "Filtros"                                        | Se despliega el panel con los criterios BPIN, Indicador, Producto, Contrato, Sector y Programa. Las opciones de cada criterio solo incluyen valores que existen en el corte mostrado | Feliz   | Antes 10a-CA01. Backend (opciones de filtro) listo; panel de UI pendiente. |
| E02-HU10-CA02 | Filtrar por BPIN                                | Panel abierto                                                         | selecciona un BPIN (ej: "2026-1234")                        | La matriz muestra solo filas con ese BPIN y el contador indica "Mostrando X de Y registros"                | Feliz   | Antes 10a-CA02 |
| E02-HU10-CA03 | Autocompletar BPIN y Contrato                   | El campo BPIN o Contrato tiene el foco                                 | escribe 3 o más caracteres (ej: "2026")                     | Se sugieren hasta 10 valores que contienen el texto, sin distinguir mayúsculas ni guiones. Sin coincidencias: "Sin coincidencias" | Alterno | Antes 10a-CA03 y 10d-CA02. Sin endpoint propio — ver Decisiones aplicadas. |
| E02-HU10-CA04 | Filtrar por Indicador                           | Panel abierto                                                         | abre la lista de Indicador y elige uno (ej: "Tasa de alfabetización") | La lista muestra "código – nombre" de los indicadores del Plan Indicativo del corte, con buscador; la matriz muestra solo filas de ese indicador | Feliz   | Antes 10b-CA01 y CA03 |
| E02-HU10-CA05 | Filtrar por Producto                            | Panel abierto                                                         | elige un producto (ej: "Aulas construidas")                 | La matriz muestra solo filas de ese producto                                                               | Feliz   | Antes 10c-CA01 |
| E02-HU10-CA06 | Filtrar por Contrato                            | Panel abierto                                                         | elige un número de contrato (ej: "2026-001-001")             | La matriz muestra todas las filas asociadas a ese contrato, incluso si pertenecen a varias metas            | Feliz   | Antes 10d-CA01 |
| E02-HU10-CA07 | Filtrar por Sector                               | Panel abierto                                                         | elige un sector (ej: "Educación")                            | La matriz muestra solo filas de ese sector                                                                 | Feliz   | Filtra sobre `MetaORM.sector` (PDT), no `RubroORM.codigo_sector_ccpet` (CCPET) — ver Decisiones aplicadas. |
| E02-HU10-CA08 | Varios valores del mismo criterio (OR)          | Panel abierto                                                         | selecciona 2 o más valores de un mismo criterio (ej: 2 indicadores) | La matriz muestra las filas que cumplen cualquiera de esos valores                                         | Negocio | Antes 10b-CA02 |
| E02-HU10-CA09 | Criterios distintos combinados (AND)            | Hay un filtro activo (ej: BPIN 2026-1234)                              | agrega otro criterio (ej: Sector Educación)                  | La matriz muestra solo las filas que cumplen todos los criterios a la vez                                   | Negocio | Antes 10c-CA02 y 10e-CA01 |
| E02-HU10-CA10 | Modificar un filtro conserva los demás          | Hay varios filtros activos, visibles como etiquetas sobre la matriz    | cambia o quita (X) uno de ellos                               | La matriz se recalcula conservando los demás filtros                                                        | Negocio | Antes 10e-CA02. Pendiente de frontend. |
| E02-HU10-CA11 | Sin resultados                                   | Hay filtros activos                                                   | ninguna fila cumple la combinación                           | Se muestra "No hay registros que cumplan los filtros seleccionados" con la opción "Limpiar filtros"         | Error   | Antes 10e-CA03. Pendiente de frontend. |
| E02-HU10-CA12 | Limpiar filtros                                  | Hay uno o más filtros activos                                         | selecciona "Limpiar filtros"                                  | La matriz vuelve a mostrar todos los registros del corte y el contador muestra el total                    | Alterno | Antes 10a-CA04 y 10e-CA04. Pendiente de frontend. |
| E02-HU10-CA13 | Persistencia de filtros                          | Hay filtros activos                                                   | pagina u ordena la matriz / cambia a otro corte               | Al paginar u ordenar los filtros se mantienen; al cambiar de corte se limpian                               | Negocio | Pendiente de frontend. |
| E02-HU10-CA14 | Registros sin valor en el criterio              | Hay filas sin BPIN o sin contrato (no relacionadas)                    | filtra por BPIN o Contrato                                    | Esas filas no aparecen en el resultado; sí aparecen cuando no hay filtro sobre ese criterio                 | Negocio | Evita ambigüedad con registros no relacionados. |
| E02-HU10-CA15 | Tiempo de respuesta                              | Corte con el volumen real de datos                                    | aplica cualquier combinación de filtros                       | El resultado se muestra en 3 segundos o menos                                                               | Negocio | `[VALIDAR]` volumen y umbral — ver `docs/DECISIONES.md`, D4. |
| E02-HU10-CA16 | Filtrar por Programa                             | Panel abierto                                                         | elige un programa (ej: "Educación para todos")                 | La matriz muestra solo filas de ese programa                                                                | Negocio | Agregado Sprint 2 — ver Decisiones aplicadas. |
| E02-HU10-CA17 | Mostrar nombre del proyecto en la matriz        | La matriz de relación de un corte está visible (filtrada o no)        | se muestra cualquier fila con BPIN asociado                    | La fila incluye el nombre del proyecto (no solo el código BPIN)                                              | Negocio | Agregado Sprint 2 — en rigor es un ajuste al contrato de salida de [E02-HU07], ya cerrada; se absorbe aquí en vez de reabrirla. |

## Reglas de negocio

- Los 6 filtros son repetibles (`?bpin=a&bpin=b`) y se combinan con **OR
  dentro del mismo criterio** (CA-08) y **AND entre criterios distintos**
  (CA-09).
- Una fila sin valor en el criterio filtrado (ej. sin BPIN) nunca aparece
  cuando ese criterio está activo (CA-14) — evita que un `NULL` se
  interprete como coincidencia.
- Las opciones de cada criterio (endpoint `opciones-filtro`) están acotadas
  al corte mostrado — nunca listan valores de otro corte (CA-01).

## Datos involucrados

Ver [docs/DATOS.md](../DATOS.md). Puntos propios de esta HU:

- Sector y Programa filtran sobre `MetaORM` (datos del PDT), **no** sobre
  `RubroORM` (clasificación presupuestal CCPET) — son dos conceptos de
  "sector" distintos en el esquema. Ver Decisiones aplicadas.
- `nombre_proyecto` viene de `ProyectoORM.nombre_proyecto` (ya cargado desde
  [E02-HU04]).

## Contrato

- `GET /matriz-relacion/{corte_id}` y `GET /matriz-relacion/actual` —
  aceptan `bpin`, `cod_indicador_producto`, `producto`, `numero_contrato`,
  `sector`, `programa` como query params repetibles, además de los ya
  existentes (`pagina`, `tamano_pagina`, `estado_cruce`, `busqueda`).
- `GET /matriz-relacion/{corte_id}/opciones-filtro` — valores disponibles
  por criterio para el corte dado (CA-01, CA-03).

## Estados y errores

Mismos que [E02-HU07] (sin cambios por esta HU):

| Código HTTP | `codigo`                | Cuándo                                                      |
| ----------- | ------------------------ | -------------------------------------------------------------- |
| 404         | `recurso_no_encontrado`  | `corte_id` no existe                                            |
| 409         | `operacion_no_permitida` | Al corte le falta alguna de las 3 fuentes (`motivo: fuentes_incompletas`) |

## Decisiones aplicadas

- **Sector/Programa sobre `MetaORM`, no `RubroORM`:** para que una meta sin
  cruce presupuestal (CA-8 de HU-07: sin asociación ficticia) no desaparezca
  del filtro por no tener `codigo_sector_ccpet`. `RubroORM` es clasificación
  presupuestal (CCPET), una dimensión distinta de "sector" a la del Plan
  Indicativo.
- **CA-03 sin endpoint propio de autocompletado:** el frontend filtra
  client-side ("contiene", desde 3 caracteres) sobre los `bpin`/`contratos`
  que ya trae `opciones-filtro` — evita un cuarto endpoint solo para
  autocompletar sobre datos que ya están en memoria del cliente.
- **CA-16 (Programa) y CA-17 (nombre del proyecto) se agregan al alcance
  original:** validado contra `TranscripcionReunion3Emilse.md` (su PowerBI
  organiza el seguimiento "por sectores, por programa y por BPIN") y
  `TranscripcionReunion5Emilse.md` (pedido explícito de Emilse: "con que
  esté el código de BPIN, el nombre del proyecto y el indicador de
  producto... ya podemos hacer el filtro"). Ambos campos ya existían en BD
  (`MetaORM.programa`, `docs/DECISIONES.md` D22; `ProyectoORM.nombre_proyecto`,
  [E02-HU04]) — no requirieron migración.
- **CA-17 se absorbe en el contrato de salida de [E02-HU07]** en vez de
  abrir una revisión separada de esa historia ya cerrada.
