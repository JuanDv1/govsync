# [E04-HU05] Visualizar registros no relacionados

**Estado de la Specification:** Borrador

## Origen

Hoja «HU_E04_05» del levantamiento de requisitos v3.0 y decisiones del
refinamiento del 2026-11-11 (tarjeta «[E-04/HU-05] BE»). Mientras esta spec
esté en `Borrador`, la fuente de requisitos es esa hoja más la tarjeta.

## Historia

Como administradora y alcalde, quiero visualizar los registros que no
pudieron relacionarse durante el cruce, para revisar manualmente casos que
requieren validación.

## Alcance

- **Incluye (backend):** CA01 a CA07, incluida la exportación a Excel.
- **Fuera de alcance:** la pantalla (tarjeta FE). La vista **no** es
  pública (decisión 8 del refinamiento).

## Actores y permisos

`administrador` y `visitante` (alcalde), los actores que nombra la
historia. La decisión 8 del refinamiento decía "cualquier rol autenticado",
pero D37 (PO, 2026-11-11) dejó al `gestor` sin módulos en esta versión: se
aplica la regla más reciente. `gestor` → 403.

## Criterios de aceptación

Los de la hoja «HU_E04_05», con CA03 y CA05 ajustados en el refinamiento.

| ID            | Estado en backend                                                                          |
| ------------- | ------------------------------------------------------------------------------------------ |
| E04-HU05-CA01 | Implementado: `GET /registros-no-relacionados/{corte_id}`                                  |
| E04-HU05-CA02 | Implementado: Fuente, Código, Descripción, Valor y Motivo (con etiquetas)                  |
| E04-HU05-CA03 | Implementado: catálogo cerrado de 9 motivos, enum `Motivo` en el OpenAPI                   |
| E04-HU05-CA04 | Implementado: filtros `fuente` y `motivo` (listas; OR dentro, AND entre), antes de paginar |
| E04-HU05-CA05 | Implementado: `total` = suma de `conteos_por_fuente` = filas del Excel con esos filtros    |
| E04-HU05-CA06 | Implementado: lista vacía y `total` 0 (el mensaje lo pone el frontend)                     |
| E04-HU05-CA07 | Implementado: `GET /registros-no-relacionados/{corte_id}/exportar` con los mismos filtros  |

## Reglas de negocio

- **Qué es "no relacionado"** (decisión 1): metas a las que les falta algún
  enlace, y rubros, registros presupuestales, contratos y proyectos BPIN que
  no llegan a ninguna meta.
- **Granularidad** (decisión 2): una fila por (registro, motivo). Una meta
  sin BPIN y sin ejecución aparece dos veces. El contador cuenta filas.
- **Lo excluido a propósito del cruce no cuenta** (decisión 5, (R)):
  subtotales de ejecución, rubros con sector vacío o "NA" (regla 1b) y
  contratos que no son de INVERSIÓN (regla 1c). Se reutilizan las mismas
  constantes del cruce (`app/shared/persistence/cruce_fuentes.py`), así que
  las dos HU no pueden divergir.
- **Valor** (decisión 7): rubro → apropiación definitiva; contrato → valor
  del contrato; meta y proyecto → vacío (`null`, nunca 0).
- Los códigos son texto: conservan los ceros a la izquierda.

### Catálogo cerrado de motivos (CA03)

| Fuente          | Código                                 | Regla                                                                                   |
| --------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| Plan Indicativo | `meta_sin_proyecto`                    | El código de la meta no está en ningún proyecto BPIN del corte                          |
| Plan Indicativo | `meta_sin_ejecucion`                   | No hay rubro de último nivel con sector válido con ese código                           |
| Plan Indicativo | `meta_sin_contrato`                    | Tiene rubro válido, pero ninguno llega a un contrato de INVERSIÓN por registro          |
| Presupuestal    | `rubro_indicador_no_existe_en_pdt`     | Rubro válido cuyo código de indicador no está en el Plan Indicativo                     |
| Presupuestal    | `rubro_sin_indicador`                  | Rubro válido sin código de indicador                                                    |
| Presupuestal    | `registro_rubro_no_existe`             | Registro presupuestal cuyo rubro no se encontró en la ejecución (solo INVERSIÓN)        |
| Presupuestal    | `contrato_bpin_no_existe_en_plantilla` | BPIN del contrato que no está en la plantilla del corte (solo INVERSIÓN), ver abajo (R) |
| BPIN            | `proyecto_indicador_no_existe_en_pdt`  | Indicador del proyecto que no está en el Plan Indicativo (una fila por indicador)       |
| BPIN            | `proyecto_sin_indicador`               | Proyecto sin ningún indicador reconocible                                               |

`meta_sin_contrato` no se reporta para una meta sin rubro: ya la reporta
`meta_sin_ejecucion`.

## Contrato

- `GET /api/v1/registros-no-relacionados/{corte_id}` — `administrador` o
  `visitante`. Query: `fuente` y `motivo` (repetibles), `pagina` (≥ 1) y
  `tamano_pagina` (1 a 200, por defecto 50). Respuesta: `total`,
  `conteos_por_fuente` (siempre las tres fuentes), `pagina`,
  `tamano_pagina` y `filas` con `fuente`, `fuente_etiqueta`, `codigo`,
  `descripcion`, `valor`, `motivo` y `motivo_etiqueta`.
- `GET /api/v1/registros-no-relacionados/{corte_id}/exportar` — mismos
  permisos y filtros, sin paginar. Archivo
  `No_Relacionados_<vigencia>_Corte_<AAAA-MM-DD>.xlsx`.

`[VALIDAR]` **acordar con Cristhian** (tarea de la tarjeta): qué va en
Código y Descripción de cada fuente, que la hoja no define. Propuesta
implementada:

| Registro              | Código                                | Descripción                                        |
| --------------------- | ------------------------------------- | -------------------------------------------------- |
| Meta                  | Código de indicador de producto       | Nombre del producto                                |
| Rubro                 | `codigo_rubro_nivel` (llave real, D3) | "Indicador …" (si tiene) · nombre del sector       |
| Registro presupuestal | Código de rubro tal como viene        | "Contrato …"                                       |
| Contrato              | Número de contrato                    | "BPIN …" · objeto                                  |
| Proyecto              | BPIN                                  | "Indicador …" o texto crudo del indicador · nombre |

## Estados y errores

| Código HTTP | `codigo`                 | Cuándo                                                                                |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------- |
| 401         | `credenciales_invalidas` | Sin token                                                                             |
| 403         | `permiso_insuficiente`   | Rol distinto de `administrador`/`visitante`                                           |
| 404         | `recurso_no_encontrado`  | El corte no existe                                                                    |
| 409         | `operacion_no_permitida` | Corte en BORRADOR (`corte_no_registrado`) o sin las 3 fuentes (`fuentes_incompletas`) |
| 422         | —                        | `fuente`/`motivo` fuera del catálogo o paginación fuera de límites                    |

## Decisiones aplicadas

- **Comparación de BPIN** (`contrato_bpin_no_existe_en_plantilla`): por año
  (4 dígitos) + consecutivo sin ceros de relleno (`clave_bpin`). Con los
  archivos reales, la plantilla trae BPIN de 15 dígitos y la ejecución de 14
  o 16; la comparación literal reportaba como inexistentes 10 de 17
  contratos que sí estaban. `[VALIDAR]` con la clienta junto con el punto (R)
  de este motivo.
- **Valor del registro presupuestal:** `valor_registro_ptal` del registro,
  no el valor del contrato (un contrato con varios registros repetiría el
  valor completo en cada fila). La decisión 7 no menciona este caso.
  `[VALIDAR]`.
- **409 en BORRADOR:** la tarjeta pide 409 para un corte en BORRADOR o con
  fuentes incompletas. La matriz (que la tarjeta cita como "mismo criterio")
  solo rechaza fuentes incompletas; aquí se aplican las dos, como dice la
  tarjeta.
- **Sin tablas nuevas** (decisión 6): el reporte se calcula en cada
  consulta con nueve consultas `NOT EXISTS` (una por motivo).

## Verificación con el corte real (oráculo de CA05)

Archivos reales de la clienta (PDT SISPT 2026-08-14, ejecución de julio de
2026, Proyectos 2026), cargados por el flujo real de la aplicación, en
SQLite y en PostgreSQL 16 (mismos resultados), el 2026-11-12:

| Magnitud de D4 (re-medida después de D22) | D4 (Sprint 1) | Hoy |
| ----------------------------------------- | ------------- | --- |
| Metas totales                             | 144           | 144 |
| Metas con ejecución                       | 119           | 119 |
| Metas con BPIN                            | 67            | 67  |
| Metas sin ningún cruce                    | 24            | 24  |
| Proyectos BPIN                            | 38            | 38  |
| Subtotales de ejecución excluidos         | 111           | 110 |

Reporte de no relacionados del mismo corte: 189 filas (Plan Indicativo
181, Presupuestal 8, BPIN 0): `meta_sin_proyecto` 77 (= 144 − 67),
`meta_sin_ejecucion` 25 (= 144 − 119), `meta_sin_contrato` 79,
`contrato_bpin_no_existe_en_plantilla` 7, `rubro_indicador_no_existe_en_pdt`

1. La consulta tarda ~56 ms (mediana de 10 corridas, PostgreSQL local).
