# [E02-HU10] Filtrar matriz de relación

**Estado de la Specification:** Borrador

> Mientras esté en `Borrador`, la fuente de requisitos vigente de esta HU es
> su hoja del Excel (`docs/requisitos/GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`,
> hoja `HU_E02_10`). El estado de avance de la tarjeta vive únicamente en
> Trello. Spec retroactiva (2026-10-05): el backend ya está en `develop`
> (PR #131). Hay `[VALIDAR]` abiertos en varios apartados (ver el
> documento); impiden pasar a `Aprobada`.

## Origen

Hoja `HU_E02_10` del Excel (fusiona las antiguas HU-10a/10b/10c/10d/10e),
incluidas HU10-CA16 (Programa) y HU10-CA17 (nombre del proyecto). Ambos
criterios surgieron de las reuniones 3 y 5 con la clienta; esas
transcripciones no están versionadas en el repositorio.

## Historia

Como administradora, quiero filtrar la matriz de relación del corte
seleccionado por BPIN, Indicador, Producto, Contrato, Sector y Programa,
combinando criterios, para aislar la información de un proyecto, indicador,
producto o contrato y su trazabilidad sin reconstruir el cruce manualmente.

`[VALIDAR]`: la historia y HU10-CA01 del Excel listan 5 criterios (sin
Programa), aunque HU10-CA16 del mismo Excel agrega el filtro por Programa.
¿Programa forma parte de la historia y del panel de CA01?

## Alcance

- **Incluye:** los 6 filtros combinables sobre la matriz de relación
  (`/{corte_id}` y `/actual`), las opciones de filtro acotadas al corte y el
  nombre del proyecto en cada fila (CA01–CA17).
- **Fuera de alcance:** un endpoint propio de autocompletado (CA03 se
  resuelve en el cliente — ver Decisiones aplicadas).

## Actores y permisos

Administradora (según la historia). Sin restricción de rol definida en el
Excel para esta HU.

Hoy sin autenticación (D2). Al integrarse E-01 aplica D24 (lectura: cualquier
rol autenticado), que debe cubrir también
`GET /matriz-relacion/{corte_id}/opciones-filtro`.

## Criterios de aceptación

| ID            | Escenario                                | Dado                                                                | Cuando                                                                | Entonces                                                                                                                                                                             | Tipo    | Notas                                                                                                                                                                                            |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E02-HU10-CA01 | Panel de filtros                         | La matriz de relación de un corte está visible                      | selecciona "Filtros"                                                  | Se despliega el panel con los criterios BPIN, Indicador, Producto, Contrato, Sector y Programa. Las opciones de cada criterio solo incluyen valores que existen en el corte mostrado | Feliz   | Antes HU10-CA01 (10a-CA01). Backend (opciones de filtro) listo; panel de UI pendiente. `[VALIDAR]` ¿incluye Programa? (ver Historia).                                                            |
| E02-HU10-CA02 | Filtrar por BPIN                         | Panel abierto                                                       | selecciona un BPIN (ej: "2026-1234")                                  | La matriz muestra solo filas con ese BPIN y el contador indica "Mostrando X de Y registros"                                                                                          | Feliz   | Antes HU10-CA02 (10a-CA02). `[VALIDAR]` en "Mostrando X de Y", ¿Y es el total del corte sin filtros o el total filtrado? Hoy la API solo devuelve el total filtrado.                             |
| E02-HU10-CA03 | Autocompletar BPIN y Contrato            | El campo BPIN o Contrato tiene el foco                              | escribe 3 o más caracteres (ej: "2026")                               | Se sugieren hasta 10 valores que contienen el texto, sin distinguir mayúsculas ni guiones. Sin coincidencias: "Sin coincidencias"                                                    | Alterno | Antes HU10-CA03 (10a-CA03 y 10d-CA02). Sin endpoint propio — ver Decisiones aplicadas.                                                                                                           |
| E02-HU10-CA04 | Filtrar por Indicador                    | Panel abierto                                                       | abre la lista de Indicador y elige uno (ej: "Tasa de alfabetización") | La lista muestra "código – nombre" de los indicadores del Plan Indicativo del corte, con buscador; la matriz muestra solo filas de ese indicador                                     | Feliz   | Antes HU10-CA04 (10b-CA01 y CA03).                                                                                                                                                               |
| E02-HU10-CA05 | Filtrar por Producto                     | Panel abierto                                                       | elige un producto (ej: "Aulas construidas")                           | La matriz muestra solo filas de ese producto                                                                                                                                         | Feliz   | Antes HU10-CA05 (10c-CA01).                                                                                                                                                                      |
| E02-HU10-CA06 | Filtrar por Contrato                     | Panel abierto                                                       | elige un número de contrato (ej: "2026-001-001")                      | La matriz muestra todas las filas asociadas a ese contrato, incluso si pertenecen a varias metas                                                                                     | Feliz   | Antes HU10-CA06 (10d-CA01).                                                                                                                                                                      |
| E02-HU10-CA07 | Filtrar por Sector                       | Panel abierto                                                       | elige un sector (ej: "Educación")                                     | La matriz muestra solo filas de ese sector                                                                                                                                           | Feliz   | Antes HU10-CA07. Qué campo de sector usa — ver Decisiones aplicadas.                                                                                                                             |
| E02-HU10-CA08 | Varios valores del mismo criterio (OR)   | Panel abierto                                                       | selecciona 2 o más valores de un mismo criterio (ej: 2 indicadores)   | La matriz muestra las filas que cumplen cualquiera de esos valores                                                                                                                   | Negocio | Antes HU10-CA08 (10b-CA02).                                                                                                                                                                      |
| E02-HU10-CA09 | Criterios distintos combinados (AND)     | Hay un filtro activo (ej: BPIN 2026-1234)                           | agrega otro criterio (ej: Sector Educación)                           | La matriz muestra solo las filas que cumplen todos los criterios a la vez                                                                                                            | Negocio | Antes HU10-CA09 (10c-CA02 y 10e-CA01).                                                                                                                                                           |
| E02-HU10-CA10 | Modificar un filtro conserva los demás   | Hay varios filtros activos, visibles como etiquetas sobre la matriz | cambia o quita (X) uno de ellos                                       | La matriz se recalcula conservando los demás filtros                                                                                                                                 | Negocio | Antes HU10-CA10 (10e-CA02). Pendiente de frontend.                                                                                                                                               |
| E02-HU10-CA11 | Sin resultados                           | Hay filtros activos                                                 | ninguna fila cumple la combinación                                    | Se muestra "No hay registros que cumplan los filtros seleccionados" con la opción "Limpiar filtros"                                                                                  | Error   | Antes HU10-CA11 (10e-CA03). Pendiente de frontend.                                                                                                                                               |
| E02-HU10-CA12 | Limpiar filtros                          | Hay uno o más filtros activos                                       | selecciona "Limpiar filtros"                                          | La matriz vuelve a mostrar todos los registros del corte y el contador muestra el total                                                                                              | Alterno | Antes HU10-CA12 (10a-CA04 y 10e-CA04). Pendiente de frontend. `[VALIDAR]` ¿"el total" es el total del corte sin filtros? (misma pregunta que CA02).                                              |
| E02-HU10-CA13 | Persistencia de filtros                  | Hay filtros activos                                                 | pagina u ordena la matriz / cambia a otro corte                       | Al paginar u ordenar los filtros se mantienen; al cambiar de corte se limpian                                                                                                        | Negocio | Antes HU10-CA13. Pendiente de frontend. `[VALIDAR]` ¿la matriz debe poder ordenarse? Ningún CA define ordenamiento y hoy el orden es fijo; si no aplica, se quita "u ordena".                    |
| E02-HU10-CA14 | Registros sin valor en el criterio       | Hay filas sin BPIN o sin contrato (no relacionadas)                 | filtra por BPIN o Contrato                                            | Esas filas no aparecen en el resultado; sí aparecen cuando no hay filtro sobre ese criterio                                                                                          | Negocio | Antes HU10-CA14. Evita ambigüedad con registros no relacionados.                                                                                                                                 |
| E02-HU10-CA15 | Tiempo de respuesta                      | Corte con el volumen real de datos                                  | aplica cualquier combinación de filtros                               | El resultado se muestra en 3 segundos o menos                                                                                                                                        | Negocio | Antes HU10-CA15. `[VALIDAR]` ¿umbral de 3 s (Excel) o de 4 s (carga de vistas, D4)? ¿El volumen de Santa Rosa es representativo de otros municipios categoría 6? — ver `docs/DECISIONES.md`, D4. |
| E02-HU10-CA16 | Filtrar por Programa                     | Panel abierto                                                       | elige un programa (ej: "Educación para todos")                        | La matriz muestra solo filas de ese programa                                                                                                                                         | Negocio | Antes HU10-CA16. Agregado Sprint 2 — ver Decisiones aplicadas.                                                                                                                                   |
| E02-HU10-CA17 | Mostrar nombre del proyecto en la matriz | La matriz de relación de un corte está visible (filtrada o no)      | se muestra cualquier fila con BPIN asociado                           | La fila incluye el nombre del proyecto (no solo el código BPIN)                                                                                                                      | Negocio | Antes HU10-CA17. Agregado Sprint 2 — en rigor es un ajuste al contrato de salida de [E02-HU07], ya cerrada; se absorbe aquí en vez de reabrirla.                                                 |

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

- `nombre_proyecto` viene de `ProyectoORM.nombre_proyecto` (ya cargado desde
  [E02-HU04]).
- El «nombre» del selector de Indicador (CA04) es `nombre_producto` del PDT:
  el archivo real no trae un nombre de indicador distinto (ver
  [docs/DATOS.md](../DATOS.md) §1).

## Contrato

- `GET /matriz-relacion/{corte_id}` y `GET /matriz-relacion/actual` —
  aceptan `bpin`, `cod_indicador_producto`, `producto`, `numero_contrato`,
  `sector`, `programa` como query params repetibles, además de los ya
  existentes (`pagina`, `tamano_pagina`, `estado_cruce`, `busqueda`) —
  autenticación: ver Actores y permisos.
- `GET /matriz-relacion/{corte_id}/opciones-filtro` — valores disponibles
  por criterio para el corte dado (CA-01, CA-03) — autenticación: ver
  Actores y permisos.

## Estados y errores

Mismos que [E02-HU07] para la matriz; `opciones-filtro` (nuevo) responde igual:

| Código HTTP | `codigo`                                             | Cuándo                                                                    |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| 404         | `recurso_no_encontrado`                              | `corte_id` no existe                                                      |
| 404         | `recurso_no_encontrado`                              | `/actual`: no hay ningún corte Registrado                                 |
| 409         | `operacion_no_permitida`                             | Al corte le falta alguna de las 3 fuentes (`motivo: fuentes_incompletas`) |
| 422         | (validación nativa de FastAPI, sin sobre `{codigo}`) | `corte_id` no es UUID o `estado_cruce` no es un valor válido              |

## Decisiones aplicadas

- **Sector/Programa sobre `MetaORM`, no `RubroORM`:** para que una meta sin
  cruce presupuestal (CA-8 de HU-07: sin asociación ficticia) no desaparezca
  del filtro por no tener `codigo_sector_ccpet`. `RubroORM` es clasificación
  presupuestal (CCPET), una dimensión distinta de "sector" a la del Plan
  Indicativo.
- Supera la propuesta de D22 (filtro de sector sobre CCPET; filtros exactos
  de BPIN/contrato descartados en favor de `busqueda`).
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

---

Esta Specification define **qué** debe hacer el sistema, no **cómo**
implementarlo. No incluir componentes, archivos, hooks, funciones, Tailwind
ni detalles internos de implementación, salvo que sean necesarios para
definir el comportamiento.
