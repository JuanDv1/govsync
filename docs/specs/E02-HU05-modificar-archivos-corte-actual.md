# [E02-HU05] Modificar archivos del corte actual

**Estado de la Specification:** Borrador

> Mientras esté en `Borrador`, la fuente de requisitos vigente de esta HU es
> su hoja del Excel (`docs/requisitos/GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`,
> hoja `HU_E02_05`). El estado de avance de la tarjeta vive únicamente en
> Trello, no en este documento. Hay `[VALIDAR]` abiertos en varios apartados
> (ver el documento); impiden pasar a `Aprobada`.

## Origen

Hoja `HU_E02_05` del Excel de levantamiento de requisitos.

## Historia

Como administradora quiero modificar los archivos asociados al corte más
reciente para corregir información cargada de forma errónea o incompleta sin
generar un nuevo corte.

## Alcance

- **Incluye:** reemplazar un archivo de una de las tres fuentes (Plan
  Indicativo, Presupuestal, Plantilla BPIN) del corte actual — el corte
  Registrado más reciente, global (ver Reglas de negocio) — y el recálculo
  del cruce correspondiente (su mecanismo exacto queda `[VALIDAR]`, ver
  Reglas de negocio).
- **Fuera de alcance:** cortes que no son el actual (CA05); conservar el
  `.xlsx` reemplazado (decisión cerrada, ver Decisiones aplicadas); crear un
  corte nuevo; el flujo de reemplazo durante la creación de un corte en
  Borrador — eso es [E02-HU06].

## Actores y permisos

Administradora (único rol que el Excel define para esta acción; CA09 niega
la acción explícitamente a "Supervisor" y "Alcalde").

`[VALIDAR]`: el módulo de identidad (E-01) no existe todavía en `develop`
(`docs/DECISIONES.md` D2), y los nombres de rol del Excel no tienen un
mapeo confirmado contra el modelo de roles que E-01 terminaría usando — ver
Decisiones aplicadas para el detalle.

## Criterios de aceptación

| ID            | Escenario                             | Dado                                                                                                                               | Cuando                                                                                                 | Entonces                                                                                                                                                                                                                                                     | Tipo    | Notas                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E02-HU05-CA01 | Acceder a edición del corte actual    | Existe un corte en estado Registrado que es el más reciente (global — ver Reglas de negocio) y la usuaria tiene rol Administradora | abre Gestión de Cortes                                                                                 | Ve la acción "Editar archivos" solo en ese corte. Al abrirla ve las 3 fuentes (Plan Indicativo, Presupuestal, Plantilla BPIN) con nombre de archivo, fecha de carga y usuario que cargó                                                                      | Feliz   | Antes HU05-CA01. "Usuario que cargó" depende de E-01, `[VALIDAR]` (ver Actores y permisos y Decisiones aplicadas). "Fecha de carga" hoy no se actualiza al reemplazar un archivo — `[VALIDAR]`, ver Decisiones aplicadas.                                             |
| E02-HU05-CA02 | Reemplazar archivo válido             | Está en "Editar archivos" del corte actual                                                                                         | selecciona "Reemplazar" en una fuente y carga un archivo válido                                        | El sistema valida el archivo con las mismas reglas de carga (HU-02/03/04), lo reemplaza, vuelve a ejecutar el cruce del corte y actualiza la matriz de relación y el Plan de Acción. Muestra "Archivo reemplazado y cruce recalculado"                       | Feliz   | Antes HU05-CA02. "Actualiza el Plan de Acción" queda `[VALIDAR]`: no existe ningún módulo de Plan de Acción en el código (E04-HU01 sin implementar). `[VALIDAR]`: hoy el recálculo del cruce es implícito, ver Reglas de negocio.                                     |
| E02-HU05-CA03 | Confirmación antes de reemplazar      | Seleccionó un archivo de reemplazo válido                                                                                          | el sistema va a aplicar el cambio                                                                      | Muestra "Se reemplazará \<archivo anterior> por \<archivo nuevo> y se recalculará la matriz del corte \<fecha>. ¿Desea continuar?". Si cancela, nada cambia                                                                                                  | Negocio | Antes HU05-CA03. `[VALIDAR]`: hoy no existe una validación del archivo separada de aplicar el cambio — ver Contrato y Decisiones aplicadas.                                                                                                                           |
| E02-HU05-CA04 | Archivo de reemplazo inválido         | Está reemplazando un archivo                                                                                                       | carga un archivo con formato no permitido, columnas obligatorias faltantes o tipos de dato incorrectos | No reemplaza, conserva el archivo y la matriz anteriores y muestra la lista de errores indicando columna y fila                                                                                                                                              | Error   | Antes HU05-CA04                                                                                                                                                                                                                                                       |
| E02-HU05-CA05 | Cortes anteriores no editables        | Existe un corte que no es el más reciente (global)                                                                                 | la administradora lo consulta o intenta editarlo (incluso por URL/API)                                 | La acción "Editar archivos" no aparece; un intento directo responde "Solo se puede editar el corte más reciente"                                                                                                                                             | Negocio | Antes HU05-CA05. Un corte registrado después pero con `fecha_corte` anterior NO es el actual y no es editable (ver Reglas de negocio).                                                                                                                                |
| E02-HU05-CA06 | Registro de auditoría                 | Se reemplazó un archivo                                                                                                            | se consulta el historial del corte                                                                     | Queda registrado en el historial del corte: fuente, nombre del archivo anterior, usuario y fecha/hora del reemplazo. El archivo `.xlsx` anterior en sí (su contenido) NO se conserva ni es descargable después del reemplazo — solo el registro de auditoría | Negocio | Antes HU05-CA06. Decisión cerrada — ver Decisiones aplicadas (no repetida aquí). `[VALIDAR]`: el usuario depende de E-01.                                                                                                                                             |
| E02-HU05-CA07 | Conservar avances físicos registrados | Supervisores ya registraron avance físico (E-03) en el corte                                                                       | se reemplaza un archivo y se recalcula el cruce                                                        | Los avances físicos de metas que siguen existiendo se conservan. Si alguna meta deja de existir, el sistema lo informa en el resultado del recálculo                                                                                                         | Negocio | Antes HU05-CA07. `[VALIDAR]`: decisión 4.0 de `03_DECISIONES_SPRINT2` sigue `Abierta`; `avance_fisico/` no tiene código (solo `.gitkeep`, verificado); la estabilidad de "código de meta" entre cortes no está confirmada en `docs/DECISIONES.md` ni `docs/DATOS.md`. |
| E02-HU05-CA08 | Fallo durante el recálculo            | Se reemplazó un archivo válido                                                                                                     | el recálculo del cruce falla                                                                           | El sistema revierte al estado anterior (archivos y matriz previos) y muestra "No fue posible recalcular el cruce; no se aplicaron cambios"                                                                                                                   | Error   | Antes HU05-CA08. Operación atómica (rollback) — mismo patrón que ya usa `ServicioCortes.cargar_archivo` (ver Reglas de negocio).                                                                                                                                      |
| E02-HU05-CA09 | Restricción por rol                   | Usuario con rol Supervisor o Alcalde                                                                                               | ingresa a Gestión de Cortes o intenta la acción por URL                                                | No ve la acción "Editar archivos" y un intento directo es rechazado por permisos                                                                                                                                                                             | Negocio | Antes HU05-CA09. `[VALIDAR]`: depende de E-01 — ver Actores y permisos (choque de nombres de rol con D23, sin mapear) y Decisiones aplicadas.                                                                                                                         |

## Reglas de negocio

- **"Corte actual" (editable por esta HU) es global, no por vigencia:** el
  corte Registrado con mayor fecha de corte; en empate, mayor fecha de
  creación. Verificado en el método `RepositorioCortesSQL.ultimo_registrado`
  (módulo `cortes/persistence/repositorios.py`) — filtra `estado ==
REGISTRADO`, ordena por fecha de corte y fecha de creación descendentes, y
  el filtro de vigencia es opcional. Lo expone
  `ServicioCortes.obtener_corte_actual` ("corte REGISTRADO más reciente,
  global (sin filtro de vigencia)" — docstring literal), ya usado por
  `GET /matriz-relacion/actual`. Coherente con D11 (`docs/DECISIONES.md`):
  el mismo criterio "global, no por vigencia".
- **No confundir ese "más reciente" con el de la reutilización de fuentes al
  crear un corte** (HU-01/CA-5): ese es el último Registrado de la misma
  vigencia, y solo para PDT y PROYECTOS — nunca EJECUCION (HU-01/CA-7).
  Verificado en `ServicioCortes._reutilizar_fuentes`, que sí filtra por
  vigencia. Son dos conceptos de "más reciente" distintos a propósito; esta
  HU solo usa el global.
- **Hallazgo pendiente de validar con el equipo — "recalcular el cruce"
  (CA02/CA08) podría no requerir una operación explícita de backend**: la
  matriz de HU-07 (función `construir_matriz`, módulo
  `trazabilidad/persistence/consultas.py`) se calcula en el momento de la
  consulta mediante un JOIN sobre las fuentes ya persistidas — no vuelve a
  leer ningún Excel (docstring de esa función). Reemplazar un archivo ya
  sobrescribe esas tablas por completo (funciones de reemplazo del
  repositorio de datos del corte), así que la siguiente consulta de la
  matriz quedaría actualizada sin ninguna acción adicional. `[VALIDAR]`: si
  el equipo considera esto suficiente para lo que pide el CA, o si hace
  falta algún paso explícito adicional que hoy no existe (ver Decisiones
  aplicadas).
- Los dos estados de `Corte` (`BORRADOR`/`REGISTRADO`) y la transición entre
  ellos: [D7, `docs/DECISIONES.md`](../DECISIONES.md).
- Un solo corte en Borrador a la vez, y el criterio global (no por vigencia)
  que también usa "corte actual": [D11, `docs/DECISIONES.md`](../DECISIONES.md).

## Datos involucrados

Las entidades que esta HU reemplaza por fuente (`Meta`, `Rubro`/`Contrato`/
`RegistroPresupuestal`, `Proyecto`/`ProyectoIndicador`) y el detalle de qué
columna de cada archivo real alimenta cada campo están en
[docs/DATOS.md](../DATOS.md) — no se duplica aquí. `ArchivoFuente`
(`nombre_archivo`, `fecha_carga`, `filas_reconocidas`) es el registro por
fuente que CA01 consulta.

## Contrato

**PROPUESTA** — sujeta al OpenAPI generado por FastAPI una vez implementada;
si difiere, el OpenAPI manda y esta spec se corrige en el mismo PR. Sin
esquemas de request/response:

- Un endpoint para reemplazar el archivo de una fuente en el corte actual ya
  Registrado — **distinto** de `POST /cortes/{id}/archivos/{tipo}`, que ya
  rechaza explícitamente cualquier corte Registrado con 409 (función
  `Corte.verificar_modificable`, `[E02-HU06]`). Permisos: Administradora
  (sujeto a lo que confirme E-01, ver Actores y permisos). `[VALIDAR]`: hoy
  no existe una validación del archivo separada de aplicar el cambio — el
  mismo endpoint que valida es el que reemplaza. Dos opciones sin elegir:
  (A) una validación previa sin aplicar, antes de la confirmación de CA03;
  (B) confirmar primero y revertir con rollback si el archivo resulta
  inválido (CA04/CA08). Pendiente de que el equipo decida con backend.
- Ampliación de `GET /cortes/{id}` para exponer `nombre_archivo` y
  `fecha_carga` de cada fuente — ya existen en el modelo (`ArchivoFuenteORM`,
  módulo `cortes/persistence/models.py`) pero `ArchivoFuenteRespuesta`
  (módulo `cortes/api/router.py`) hoy solo expone
  `tipo`/`reutilizado`/`corte_origen_id`. Cuando E-01 lo permita, agregar
  también el usuario que cargó (CA01/CA06).
- Consulta del historial de auditoría (CA06) — no existe hoy ninguna tabla
  ni endpoint de auditoría en el backend.
- Un indicador "es editable / es el actual" calculado por el backend (el
  frontend no debe recalcular el orden), expuesto en `GET /cortes` y
  `GET /cortes/{id}`.

## Estados y errores

| Código HTTP | `codigo`                                                   | Cuándo                                                                                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 404         | `recurso_no_encontrado`                                    | El corte no existe (ya existe, `app/shared/errors.py`)                                                                                                                                                                                                     |
| 409         | `operacion_no_permitida`                                   | El corte existe pero no es el más reciente (CA05) — `codigo` ya existe; `motivo` nuevo, p. ej. `corte_no_es_el_actual` **[PROPUESTA]**                                                                                                                     |
| 409         | `operacion_no_permitida`                                   | El corte sigue en Borrador — corríjalo con el flujo de creación ([E02-HU06]); `motivo` nuevo, p. ej. `corte_no_registrado` **[PROPUESTA]**                                                                                                                 |
| 403         | `codigo` nuevo **[PROPUESTA]**, p. ej. `permiso_denegado`  | Restricción por rol (CA09) — hoy no existe ninguna clase de error ni mapeo HTTP para 403 en `app/shared/errors.py`/`app/core/errores.py` (verificado: el único código de error de permisos existente es `credenciales_invalidas`, mapeado a 401, no a 403) |
| 422         | `archivo_invalido`                                         | El archivo de reemplazo no cumple el formato esperado (CA04) — `codigo` ya existe                                                                                                                                                                          |
| `[VALIDAR]` | `codigo` nuevo **[PROPUESTA]**, p. ej. `recalculo_fallido` | Fallo durante el recálculo con rollback (CA08) — código HTTP sin decidir todavía (¿409? ¿500?); es un fallo controlado con mensaje propio, no el `error_interno` genérico de excepciones no previstas                                                      |

## Decisiones aplicadas

- **Corte actual = global, no por vigencia.** Ver Reglas de negocio para la
  cita de código; la decisión en sí (qué significa "más reciente" para esta
  HU) queda registrada aquí porque el Excel original decía "de su
  vigencia" y esta spec lo corrige con base en D11 y en el código ya
  escrito de `obtener_corte_actual`/`GET /matriz-relacion/actual`.
- **`[VALIDAR]` — "recalcular el cruce" podría ya ocurrir solo por cómo se
  calcula la matriz**: ver Reglas de negocio para el detalle verificado en
  código. Se registra aquí como hallazgo pendiente de que el equipo
  confirme si eso es lo que CA02/CA08 exigen, no como una decisión ya
  tomada sobre el comportamiento de esta HU.
- **`[VALIDAR]` — validar sin aplicar no existe hoy**: el endpoint que
  valida el archivo de reemplazo es el mismo que lo aplica (ver Contrato);
  CA03 pide confirmar ANTES de aplicar, lo que supone conocer de antemano
  que el archivo es válido. Dos opciones sin elegir — (A) una validación
  previa separada de la aplicación, (B) confirmar primero y revertir con
  rollback si resulta inválido — pendiente de que el equipo decida con
  backend; no se escoge ninguna aquí.
- **CA07 y la parte de "Plan de Acción" de CA02 quedan `[VALIDAR]`**: la
  fila `4.0` de `03_DECISIONES_SPRINT2` (pregunta de HU-05 sobre avance
  físico) sigue `Abierta`; `avance_fisico/` y `alertas/` no tienen código
  (verificado: solo `.gitkeep` en ambos directorios); no existe ningún
  módulo de Plan de Acción en el backend ni el frontend (E04-HU01 sin
  implementar). No se especifican como regla de esta HU hasta que el
  equipo los resuelva.
- **Dependencia de E-01 y choque de nombres de rol**: CA01 ("usuario que
  cargó"), CA06 ("usuario") y CA09 (restricción por rol) dependen de un
  módulo de identidad que no existe en `develop` (D2, `docs/DECISIONES.md`).
  Está en construcción en la rama `origin/feat/login/be/fe` (no mergeada),
  que agrega un módulo de identidad sobre Keycloak con un modelo de roles
  (`administrador`/`gestor`/`visitante`, decisión D23 en esa misma rama,
  estado `PROPUESTA`) distinto de los nombres que usa el Excel
  ("Administradora"/"Supervisor"/"Alcalde") en CA01/CA09. En esa rama, el
  comentario del rol `gestor` es "sube/corrige cortes y archivos" — una
  pista de hacia dónde podría ir el mapeo, no una equivalencia confirmada.
  El mapeo entre ambos vocabularios queda `[VALIDAR]`, sin inferirlo aquí
  (ver Actores y permisos).
- Decisión cerrada (fila `3.0` de `03_DECISIONES_SPRINT2`, `Cerrada`): NO se
  conserva el archivo `.xlsx` reemplazado, solo el registro de auditoría
  (fuente, nombre del archivo anterior, usuario, fecha/hora) — respalda
  CA06. Motivos (no repetidos en detalle): el código no guarda el archivo
  físico de ningún corte hoy, y guardarlo sería infraestructura nueva de
  almacenamiento que el equipo ya había descartado por costo.
- **`[VALIDAR]` de producto, fuera del alcance de esta HU**: hoy no se
  valida que un corte nuevo tenga una fecha de corte posterior o igual a la
  del último Registrado — `crear_corte`/`corregir_corte` solo validan
  vigencia, fecha no futura, borrador único (D11) y duplicado
  vigencia+fecha (D9). Queda como pregunta para el PO, no como regla de
  esta HU.
- **`[VALIDAR]` — copia de datos, no referencia**: la función `copiar_datos`
  del repositorio de datos del corte genera IDs nuevos para cada fila
  copiada ("cada corte es una fotografía independiente", docstring
  literal). Si un corte en Borrador ya reutilizó PDT/PROYECTOS del corte
  actual (HU-01/CA-5) y luego esta HU reemplaza un archivo del corte
  actual, la copia ya hecha en ese corte en Borrador no se actualiza —
  queda con los datos de antes del reemplazo. Pendiente que el equipo
  decida si es el comportamiento esperado o si hace falta refrescar esas
  copias.
- **`[VALIDAR]` — `fecha_carga` no se actualiza al reemplazar**:
  `ArchivoFuenteORM.fecha_carga` (módulo `cortes/persistence/models.py`)
  solo tiene un valor por defecto evaluado al insertar la fila. La rama de
  reemplazo de la función `registrar_archivo` del mismo módulo actualiza
  nombre de archivo, filas reconocidas y origen de reutilización, pero no
  reescribe `fecha_carga` — con el código tal como está hoy, la fecha que
  CA01 pide mostrar no reflejaría el momento del reemplazo.

---

Esta Specification define **qué** debe hacer el sistema, no **cómo**
implementarlo. No incluye componentes, archivos, hooks, funciones, Tailwind
ni detalles internos de implementación, salvo los necesarios para definir el
comportamiento.
