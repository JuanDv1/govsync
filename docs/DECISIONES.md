# Decisiones de diseño y alcance — GovSync

Registro de decisiones tomadas por el equipo, con su evidencia y su estado.
Formato por entrada: **Decisión**, **Motivo/Evidencia**, **Alternativas consideradas**,
**Estado**, **Quién y cuándo**.

---

## D1 · La migración de Alembic es la única fuente de verdad del esquema

**Decisión:** el esquema vigente es el que resulta de las migraciones en
`backend/alembic/versions/`. Los archivos `govsync_schema.sql`,
`govsync_schema2.sql` y `govsync_schema_con_auditoria.sql` quedan como material
histórico de diseño, no como fuente ejecutable.

**Motivo:** circulaban tres `.sql` distintos más un diagrama E/R paralelo sin
reconciliar (señalado en `PLANDETRABAJO.md`, D1). Mientras no se decida, dos
personas pueden construir sobre esquemas distintos sin darse cuenta.

**Alternativas consideradas:** mantener uno de los `.sql` como fuente y
generar la migración a partir de él — descartada porque el equipo ya tiene el
hábito de trabajar con `alembic revision --autogenerate`, y mantener dos
fuentes sincronizadas a mano es más frágil que tener una sola.

**Estado:** RATIFICADA — el equipo confirmó la propuesta (`[REF-01]`, tarjeta
movida a "Tareas hechas" en Trello).

**Registrado:** 2026-09-08 (propuesta, a partir del análisis de `PLANDETRABAJO.md`).
**Ratificado:** 2026-09-08 por el equipo.

---

## D2 · Autenticación (E-01) diferida al Sprint 2

**Decisión:** las Historias de Usuario de la épica E-01 (Gestión de Acceso y
Roles) no entran al Sprint 1. El esqueleto no incluye módulo de identidad ni
JWT. Las filas "Autenticación" y "Autorización" de la Tabla 4 (OWASP) de la
rúbrica del Sprint 1 quedan como **N/A con esta justificación**, no vacías.

**Motivo:** el Sprint Backlog comprometido en la Entrega 1 (Tabla 8 del
documento de Entrega 1) ya fijó 5 Historias de Usuario con story points
específicos (8, 3, 8, 13, 5 = 37 SP), ninguna de la épica E-01. Agregar
autenticación ahora significa sumar alcance no comprometido con el docente
sin haber replanificado la capacidad del equipo.

**Alternativas consideradas:** adelantar E-01 al Sprint 1 — evaluada y
descartada por ahora; ver la nota siguiente.

**Si se revierte esta decisión:** es una tarjeta nueva (`[HU-E01-01]`,
~5 SP) que entra en Fase 2 y toca `core/dependencias.py` más un módulo
nuevo `modules/identidad/`. Además, `Levantamiento de Requisitos.md` ya
tiene el enunciado de E-01/HU-01 y HU-02, pero **no tiene Criterios de
Aceptación escritos para ninguna de las dos** — habría que escribirlos antes
de estimar la tarjeta.

**Estado:** VIGENTE — responsable: Juan Esteban (`[REF-05]`).

**Registrado:** 2026-09-08.

---

## D3 · Qué archivo es "el archivo del municipio" en HU-01/CA-5

**Decisión (supuesto de trabajo, no confirmado):** "el archivo del
municipio" que se reutiliza junto con el PDT (HU-01/CA-5) es la plantilla de
proyectos BPIN (`TipoArchivoFuente.PROYECTOS`), por ser la única de las tres
fuentes que el municipio diligencia a mano en vez de exportarla de una
plataforma nacional.

**Motivo:** CA-5 dice literalmente "el PDT y el archivo del municipio se
reutilizan", y existen tres tipos de archivo (PDT, EJECUCION, PROYECTOS). Por
descarte, y por el patrón de diligenciamiento manual, se interpretó que es
PROYECTOS.

**Riesgo si el supuesto es incorrecto:** si en realidad es un cuarto archivo
distinto a los tres ya modelados, falta una tabla en el esquema y cambia
`[HU-01][BE-04]` (regla de reutilización).

**Estado:** SUPUESTO — PENDIENTE de confirmar con la clienta (Emilse). No
convertir en requisito hasta confirmar. Responsable de la pregunta: equipo
completo, antes de cerrar Fase 4 de `PLANDETRABAJO.md`.

**Registrado:** 2026-09-08.

---

## D4 · Corte de referencia para medir los atributos de rendimiento (Tabla 7, Entrega 1)

**Decisión:** el corte de referencia contra el que se miden los umbrales de
rendimiento declarados en la Entrega 1 (procesamiento completo de un corte en
menos de 60 s, carga de vistas en menos de 4 s) es el corte real de la
vigencia usada durante el desarrollo del Sprint 1, con los siguientes
volúmenes verificados contra los archivos reales de la clienta:

| Magnitud                                                            | Valor                                    |
| ------------------------------------------------------------------- | ---------------------------------------- |
| Metas totales (Plan Indicativo)                                     | 144                                      |
| Metas con ejecución presupuestal asociada                           | 119                                      |
| Metas con BPIN asociado                                             | 67                                       |
| Metas sin ningún cruce (alerta de trazabilidad)                     | 24                                       |
| Subtotales de ejecución excluidos del cruce (`ultimo_nivel = true`) | 111                                      |
| Proyectos BPIN en la plantilla del municipio                        | 38 (de 134 filas, por celdas combinadas) |

**Motivo:** el docente advirtió explícitamente en la revisión de la Entrega 1
que "un umbral sin caso de prueba no es un atributo de calidad" y pidió fijar
el volumen del corte de prueba antes de la Entrega 2. Estos números ya eran el
resultado esperado documentado en `PLANDETRABAJO.md` (Fase 5, HU-07) y en el
docstring de `backend/app/modules/trazabilidad/persistence/consultas.py`; esta
entrada los deja registrados formalmente como la decisión que responde a la
observación del docente.

**Nota (2026-09-23, AS-A-JUDGE):** `D22` agrega dos reglas de negocio nuevas
a la misma consulta (`Regla 1b` — sector válido, `Regla 1c` — tipo de gasto
INVERSIÓN), que pueden excluir del cruce filas que antes sí contaban. Este
benchmark (144/119/67/40/24) no se ha vuelto a correr contra datos reales
con esas reglas aplicadas. **Pregunta para el equipo, no una decisión
tomada aquí:** ¿se re-verifica este benchmark antes de citarlo de nuevo en
la Entrega 2, o se documenta explícitamente como "vigente antes de D22"?

**Cómo se usa:** las pruebas de rendimiento y las pruebas de integración de
HU-07 (`[HU-07][BE-02]` y siguientes) deben ejecutarse contra este corte —
no contra datos sintéticos ni contra un subconjunto arbitrario — para que la
medición de los 60 s / 4 s sea comparable entre sprints.

**Estado:** VIGENTE.

**Registrado:** 2026-09-08.

---

## D5 · Reconciliación de numeración de CA entre Excel y Trello (HU-01, HU-07)

**Hallazgo:** `Levantamiento de Requisitos.md` tenía menos Criterios de
Aceptación de los que ya estaban definidos y en uso: HU-01 llegaba solo hasta
CA-7 y HU-07 solo tenía CA-1 y CA-4, mientras que el checklist "Criterios de
aceptación" de las tarjetas de Trello ya tenía el contenido completo (8 CA
para HU-01, 8 CA para HU-07) y `PLANDETRABAJO.md` y el código-esqueleto
(`casos_uso.py`, `consultas.py`, `trazabilidad/api/router.py`) ya referencian
esa numeración completa. No eran criterios inventados: existían en Trello,
solo nunca se habían volcado al documento de requisitos.

**Decisión:** Trello es la fuente más completa y `Levantamiento de
Requisitos.md` se corrigió para reconciliarse con él — se agregaron
HU01-CA08 y HU07-CA02, CA03, CA05, CA06, CA07, CA08 con el texto ya escrito en
los checklists de Trello. La única fila sin equivalente en Trello es
HU07-CA04 original (unificación de nombres de columna de indicador al
construir la matriz), que se conservó renumerada como **HU07-CA09**.

**Decisión sobre HU07-CA09 (2026-09-08):** el equipo confirmó que NO se
mantiene como Criterio independiente. Es la misma regla que HU03-CA03
(equivalencia de nombres de columna de indicador), aplicada en un momento
posterior del pipeline: para cuando la matriz se construye, la unificación
ya ocurrió en la ingesta y persiste como una sola columna — la consulta de
HU-07 no unifica nada, solo lee un dato ya unificado. Mantenerla como CA
propia duplicaba la regla en dos Historias de Usuario sin comportamiento
nuevo verificable (sobreingeniería de especificación). Se retiró de
`Levantamiento de Requisitos.md`; el caso de prueba concreto queda como nota
de regresión bajo HU07-CA02 en `docs/TRAZABILIDAD.md`. El Trello no cambia:
nunca tuvo tarjeta ni ítem de checklist para esta regla.

**Estado:** VIGENTE — decisión tomada, sin pendientes.

**Registrado:** 2026-09-08.

---

## D6 · Reconciliación de numeración de CA entre Excel, Trello y PLANDETRABAJO.md (HU-02, HU-03, HU-04)

**Hallazgo:** al revisar un export actualizado de Trello, se encontró el mismo
patrón que motivó D5, ahora en HU-02, HU-03 y HU-04: el checklist de Trello
tiene un primer criterio de acceso/carga del archivo ("la administradora
puede seleccionar/cargar el archivo X correspondiente al corte") que
`Levantamiento de Requisitos.md` nunca capturó. `PLANDETRABAJO.md` ya asigna
`CA-1` a las tarjetas de acceso de las tres historias (`casos_uso.py::
cargar_archivo` y `cortes/api/router.py`), y el código ya escrito confirma la
misma numeración: `pdt.py` cubre "CA-2, CA-3, CA-4, CA-6" (salta CA-1 y CA-5),
`ejecucion.py` cubre "CA-2, CA-4, CA-5, CA-7" (salta CA-1, CA-3 y CA-6),
`_comun.py::mapear_columnas` cita explícitamente "(HU-03/CA-3, HU-07)", y
`proyectos.py` cubre "CA-2, CA-3, CA-4, CA-5" (salta CA-1). Las tres fuentes
(Trello, PLANDETRABAJO.md, código) coincidían entre sí; solo el documento de
requisitos estaba desactualizado.

**Decisión:** se agregó CA-1 (acceso) a HU-02, HU-03 y HU-04 en
`Levantamiento de Requisitos.md`, y se renumeraron los CA existentes para
que coincidan con Trello/PLANDETRABAJO.md/código:

- **HU-02** (antes 5 CA, ahora 6): CA-1 acceso (nuevo) · CA-2 reconoce
  pestaña (antes CA-1) · CA-3 rechazo columnas faltantes (antes CA-2) · CA-4
  rechazo archivo incorrecto (antes CA-4, sin cambio) · CA-5 confirmación
  visual (antes CA-3) · CA-6 alimenta matriz (antes CA-5).
- **HU-03** (antes 6 CA, ahora 7): CA-1 acceso (nuevo) · CA-2 procesa ambas
  pestañas (antes CA-1) · CA-3 equivalencia de nombres (antes CA-2) · CA-4
  rechazo pestaña faltante (antes CA-4, sin cambio) · CA-5 rechazo archivo
  incorrecto (antes CA-5, sin cambio) · CA-6 alimenta matriz (antes CA-6,
  sin cambio) · CA-7 preserva ceros a la izquierda (antes CA-3, se mueve al
  final).
- **HU-04** (antes 4 CA, ahora 5): CA-1 acceso (nuevo) · CA-2 carga tal cual
  (antes CA-1) · CA-3 extracción acotada (antes CA-2) · CA-4 separación
  multivalor (antes CA-3) · CA-5 alimenta matriz (antes CA-4).

Se ajustaron `docs/TRAZABILIDAD.md` (HU-02 reescrita completa; HU-04 con la
fila CA-5 agregada, faltaba) y `docs/ESPECIFICACIONES_TECNICAS.md` en
consecuencia. `docs/SEGURIDAD.md` no cita estos CA, no requirió cambios. El
Trello no se modifica: ya tenía la numeración correcta.

**Estado:** VIGENTE — decisión tomada, sin pendientes.

**Registrado:** 2026-09-08.

---

## D7 · La entidad Corte tiene dos estados: BORRADOR y REGISTRADO

**Decisión:** `Corte` modela explícitamente dos estados — `BORRADOR` (creado
solo con vigencia y fecha, acepta cargas de archivos) y `REGISTRADO` (las
tres fuentes obligatorias presentes, entra al histórico). El paso de uno a
otro es la transición que exige HU-01/CA-4.

**Motivo:** sin un estado explícito, HU-01/CA-3 ("no se registra sin
archivos completos") y las cargas de HU-02/HU-03/HU-04 ("subir archivos
contra un corte que ya existe") son incompatibles entre sí — no se puede
exigir que el corte esté completo para existir, y a la vez que exista antes
de estar completo. El estado resuelve la contradicción.

**Origen:** este supuesto se identificó como `S-1` en una consolidación
anterior del plan de Trello (`SUPUESTO — confirmar en la próxima reunión`,
marcado explícitamente como algo que **afecta el esquema de BD**). No existía
ninguna entrada en este documento que lo ratificara, aunque el esqueleto de
código (`backend/app/modules/cortes/domain/entidades.py`, con
`EstadoCorte.BORRADOR`/`REGISTRADO`) y `PLANDETRABAJO.md` ya lo dan por
sentado, sin marcarlo como pendiente. Se ratifica aquí para cerrar esa
inconsistencia entre lo que el código ya asume y lo que estaba documentado
como abierto.

**Alternativas consideradas:** ninguna evaluada aparte — el propio código ya
estaba construido sobre este diseño antes de que se detectara el vacío
documental.

**Estado:** RATIFICADA.

**Registrado:** 2026-09-08.

---

## D8 · Reconciliación de CA-8 entre PLANDETRABAJO.md/TRAZABILIDAD.md y CASOS_DE_PRUEBA.md (HU-01)

**Hallazgo:** `docs/CASOS_DE_PRUEBA.md` (CP-HU01-08) marcaba CA-8 como "✅
Probado" con evidencia de `test_casos_uso_cortes.py` (capa de aplicación,
sin superficie HTTP), mientras que `PLANDETRABAJO.md` §2.7 y
`docs/TRAZABILIDAD.md` (fila CA-8) coinciden en que CA-8 es "el endpoint"
(`cortes/api/router.py`) y lo marcaban "Pendiente" hasta que
`[HU-01][FE-01]` existiera. Las tres fuentes no pueden estar en lo correcto
a la vez.

**Decisión:** se corrige `docs/CASOS_DE_PRUEBA.md` para alinearse con las
otras dos fuentes (que además asignan explícitamente la tarjeta que cierra
el CA). CP-HU01-08 pasa de "✅ Probado" a "🟡 En progreso": la prueba
existente verifica una precondición necesaria de aplicación, no la
referenciabilidad por API que el CA describe literalmente ("el corte queda
disponible como referencia... para asociarle archivos fuente").
`[HU-01][FE-01]` cierra CA-8 por completo, al exponer `GET /cortes` y
`GET /cortes/{id}`.

**Motivo:** mismo patrón que D5/D6 — un documento derivado se adelantó a
marcar un CA como cerrado con una prueba que cubre solo una parte de lo que
el CA exige.

**Alternativas consideradas:** corregir `PLANDETRABAJO.md`/`TRAZABILIDAD.md`
en vez de `CASOS_DE_PRUEBA.md` — descartada porque esas dos fuentes ya
asignan explícitamente la tarjeta que cierra el CA, más específico y
verificable que la descripción de `CASOS_DE_PRUEBA.md`.

**Estado:** VIGENTE — con nota de resolución.

**Registrado:** 2026-09-11.

**Resolución (2026-09-23):** `[HU-01][FE-01]` ya está implementado y
probado (`test_router_cortes.py::test_get_cortes_devuelve_historico_200`,
`::test_get_cortes_id_devuelve_detalle_200`), así que la referenciabilidad
por API que CA-8 exige literalmente ya está cerrada. `docs/CASOS_DE_PRUEBA.md`
(CP-HU01-08) y `docs/TRAZABILIDAD.md` (CA-8, HU-01) vuelven a marcar el
criterio como "✅ Probado" — esta vez con evidencia HTTP real, no solo de
aplicación, que era justo lo que esta decisión pedía. La decisión original
(usar el endpoint como criterio de cierre, no la capa de aplicación) sigue
vigente como precedente.

---

## D9 · Qué hace que dos cortes se consideren duplicados

**Decisión:** se rechaza la creación de un corte si ya existe otro con la
misma vigencia y la misma fecha_corte exacta. Con D11 (un solo corte en
BORRADOR activo a la vez), este conflicto solo puede darse entre cortes ya
REGISTRADO.

**Motivo:** HU-07 necesita identificar "el corte actual" sin ambigüedad
(GET /matriz-relacion/actual). Dos cortes con la misma fecha lo impiden.

**Alternativas consideradas:** unicidad solo por vigencia (D-03 en
`docs/ESPECIFICACIONES_TECNICAS.md`, sección HU-01) — descartada: impediría
más de un corte por año, contradice el uso esperado (revisiones periódicas).

**Nota:** no confundir con "D-09" en `docs/ESPECIFICACIONES_TECNICAS.md`,
sección HU-03 — es un tema distinto (filas de ejecución reconocidas),
coincidencia de número entre dos sistemas de numeración diferentes.

**Estado:** RATIFICADA.

**Registrado:** 2026-09-13.
**Ratificado:** 2026-09-13 por el equipo.

---

## D10 · La creación del corte requiere una acción explícita

**Decisión:** `POST /cortes` se dispara solo con un clic explícito (ej.
"Continuar") al cerrar el paso de vigencia/fecha, nunca porque la
validación del formulario pase mientras se escribe.

**Motivo:** en el mockup actual, el checkmark "Datos del corte
configurados" se enciende con validación en tiempo real; si disparara la
creación, cada corrección de una fecha ya válida crearía un BORRADOR nuevo.

**Riesgo si no se ratifica:** Karold puede implementar cualquiera de los
dos sin saber cuál se espera.

**Estado:** PROPUESTA — pendiente de confirmar antes de construir
`pages/NuevoCorte.jsx` (`[HU-01][FE-02]`, tarjeta 2.8).

**Registrado:** 2026-09-13.

---

## D11 · Solo un corte en BORRADOR activo a la vez

**Decisión:** al crear un corte, se rechaza si ya existe otro en BORRADOR.
Corregirlo requiere `PATCH /cortes/{id}`, que no existe hoy.

**Motivo:** el proceso real de la clienta es secuencial; simplifica D9.

**A qué afecta (no implementar aún, solo dejar constancia):** `crear_corte`
en `casos_uso.py`, método nuevo en `puertos.py`, endpoint `PATCH` sin
dueño, mapeo 409 en `core/errores.py`, migración de Alembic / `models.py`
— índice único parcial sobre `estado = 'BORRADOR'` (a lo sumo un corte en
ese estado en toda la tabla).

**Estado:** RATIFICADA.

**Registrado:** 2026-09-13.
**Ratificado:** 2026-09-13 por el equipo.
**Aclaración posterior (2026-09-18):** Cristhian y Juan David confirmaron
que D11 también requiere el índice de BD como respaldo contra condiciones
de carrera (dos peticiones casi simultáneas), no solo la validación de
aplicación. La ratificación original del 2026-09-13 no dejó esto
explícito — este PR lo cierra.

**Aclaración confirmada (2026-09-19):** antes de diseñar `PATCH
/cortes/{id}`, quedan resueltas las tres preguntas que la ratificación
original dejó abiertas:

1. El PATCH de corrección **NO aplica a cortes `REGISTRADO`**, solo a
   `BORRADOR` — editar vigencia/fecha de un corte ya registrado rompería
   el histórico; ese caso no pasa por este endpoint.
2. Es **total**, no parcial: exige `vigencia` y `fecha_corte` juntos, el
   mismo contrato de entrada que `POST /cortes` — no se admite mandar
   solo uno de los dos campos.
3. Es **exclusivamente para vigencia/fecha** — no edita `archivos`. La
   corrección de un archivo cargado por error sigue su propio mecanismo
   de reemplazo por tipo (HU-06, `registrar_archivo`), sin relación con
   este PATCH.

---

## D12 · Límite de tamaño de archivo verificado en el cliente

**Decisión:** el frontend rechaza, antes de intentar subir, cualquier
archivo mayor a 2.097.152 bytes (2 MB) — aviso inmediato en
`CargaDeArchivo.jsx`, sin llamar a `onCargar`.

**Motivo:** los archivos reales de la clienta hoy pesan menos de 200 KB;
2 MB da un margen ~10x para crecimiento sin retrasar el aviso de error
hasta después de un viaje de red completo. Coherente con el límite real de
`[SEC-03]` (`backend/app/core/config.py::max_upload_bytes`, 25 MB) — el del
cliente es más conservador, no lo reemplaza ni lo duplica.

**Estado:** RATIFICADA.

**Registrado:** 2026-09-15.
**Ratificado:** 2026-09-15, acordado con Cristhian.

## D13 · `[HU-04][BE-03]` reabierta y corregida: separadores y descartes registrados

**Hallazgo (2026-09-19, Juan David + verificación cruzada):** el texto
literal de la tarjeta Trello `[HU-04][BE-03]` exige, en "casos borde
obligatorios en los tests", dos cosas que la implementación original de
`CodigoIndicadorProducto.extraer_todos` (probada con 6 tests, solo
`split("\n")`) no cumplía:

1. Reconocer coma, punto y coma, guion y espacio como separadores además
   de salto de línea, incluyendo códigos pegados sin separador
   (segmentar de a 9 dígitos SOLO si el total es múltiplo de 9).
2. "Todo código descartado queda registrado con su motivo" — la versión
   original simplemente omitía el candidato inválido de la lista, sin
   dejar rastro.

Verificado contra la CA-4 oficial (`Levantamiento de Requisitos.md`,
`HU04-CA04`) y contra `Sprint1_Decisiones_de_Diseno.md`/
`GovSync_Guia_Tecnica.md`: ninguno de esos documentos menciona los
separadores adicionales ni el registro de descartes — solo la tarjeta de
Trello los exige explícitamente. Es la tarjeta, no la documentación
derivada, la fuente correcta aquí (jerarquía del proyecto: CA aprobados

> reglas de negocio > documentación).

**Decisión:** se reabre y corrige `[HU-04][BE-03]` en esta misma tarjeta
(no se crea TRANS-02, para no duplicar trabajo ya comprometido).

**Cambio de contrato (deliberado, no oculto):** `extraer_todos` cambia su
tipo de retorno de `list[CodigoIndicadorProducto]` a
`ResultadoExtraccionIndicadores(codigos, descartes)`. Es un cambio de API
de dominio, justificado porque el descarte con motivo es parte del
contrato exigido por la propia tarjeta, no un detalle de presentación.
Único call site afectado: `LectorProyectos.leer()`, que ahora vuelca
`descartes` al mecanismo de `advertencias` ya existente (no se construye
infraestructura nueva).

**Limitación conocida, aceptada y documentada (no bloqueante):** un monto
con coma decimal en formato colombiano (`$230.000.000,00`) produce un
candidato residual de 2 dígitos (`00`) que SÍ se registra como descarte
(cumple el texto literal de la tarjeta: cualquier candidato numérico de
longitud distinta de 9 se reporta). No fabrica un código falso ni afecta
`codigos`, solo agrega ruido a la lista de revisión manual. Pendiente de
que el equipo confirme si esto debe filtrarse en una iteración futura.

**Fuera de alcance, explícitamente (PENDIENTE S-3 de la propia tarjeta):**
verificar que cada código exista en el PDT ya cargado. La tarjeta lo
marca PENDIENTE y, de confirmarse, dependería de HU-02 — no se convierte
en requisito sin esa confirmación.

**Evidencia:** `test_codigos.py` (16 pruebas, antes 6) + actualización de
`test_lectores_proyectos.py::test_indicador_no_reconocible_...` (fixture
ajustada: contenía un "9" suelto en la prosa que ahora se registra como
descarte válido de 1 dígito — coincidencia del texto de prueba, no un
bug). 258 passed en local (2026-09-19).

**Estado:** Corregida.
**Quién y cuándo:** Juan Esteban, 2026-09-19.

## D14 · Categorización de descartes en `extraer_todos` (no cambia qué se descarta)

**Hallazgo (2026-09-19, Juan David, construyendo `[HU-04][FE-03]`):** tras
D13, `extraer_todos` registra correctamente todo candidato numérico de
longitud inválida como descarte — pero un número suelto dentro de texto
libre real (una fecha, un año, un conteo, un porcentaje sin `%`) cae en
la misma lista con el mismo motivo genérico que un intento de código
realmente roto. Ejemplo reproducido: `"Avance del 45% en la vigencia
2026"` registra `"2026"` como descarte de 4 dígitos, indistinguible de
un BPIN mal cortado. Para la tabla de revisión de FE-03 esto mezclaría
ruido con hallazgos reales, restándole valor al motivo.

**Decisión:** no se cambia qué termina en `codigos` vs `descartes` (la
lógica de D13 queda igual). Se agrega `CategoriaDescarte` (`StrEnum`,
mismo patrón que `TipoArchivo`) con tres valores estructurales, basados
únicamente en la longitud ya calculada — sin inventar heurísticas de
negocio sobre formatos de fecha/porcentaje/conteo:

- `POSIBLE_CERO_PERDIDO` (longitud == 8 hoy): probable código real con
  el cero comido por Excel. Prioridad alta de revisión.
- `LONGITUD_CORTA` (menor a 9, distinta de 8): casi siempre ruido de
  texto libre. Prioridad baja.
- `LONGITUD_LARGA` (mayor a 9, no múltiplo): casi siempre un intento
  real fallido (BPIN, monto sin separadores). Prioridad alta.

`DescarteIndicador` gana el campo `categoria` (además de `motivo`, que
se conserva sin cambios). Alternativa descartada: endurecer el propio
`extraer_todos` para dejar de registrar números cortos sueltos — se
rechaza porque metería juicio de negocio (qué es "sospechosamente
corto") en una función que hoy es puramente mecánica, y cada formato de
fecha/nota nuevo obligaría a tocarla de nuevo.

**Alcance:** cambio contenido en `app/shared/codigos.py`. No se propaga
todavía a `ResultadoLectura`/la API — `LectorProyectos.leer()` sigue
volcando `descartes` a `advertencias` como texto plano (ver nota "FUERA
DE ALCANCE" en el docstring del módulo del lector); FE-03 recibirá la
categoría cuando se construya el endpoint de vista previa, en la tarjeta
correspondiente, no en esta.

**Evidencia:** `test_codigos.py` (20 pruebas, antes 16), incluye los tres
ejemplos reales reportados por Juan David. 262 passed en local
(2026-09-19). `ruff check`/`ruff format` limpios.

**Estado:** Corregida.
**Quién y cuándo:** Juan Esteban, 2026-09-19 (hallazgo de Juan David).

---

## D15 · `[HU-02][FE-02]`: un solo mensaje de error cubre "pestaña no encontrada" y "archivo incorrecto"

**Decisión:** el frontend muestra `error.message` del backend tal cual para
los dos casos de rechazo del PDT, sin fabricar un tercer texto propio.

**Motivo:** la tarjeta de Trello pide "tres mensajes de error distintos"
(pestaña no encontrada / columna faltante / archivo que no corresponde),
pero el backend solo distingue dos `detalles.motivo` en la práctica:
`columnas_faltantes` (CA-3) y `hoja_no_encontrada` (CA-2 **y** CA-4 a la
vez). Esto no es un descuido: el propio docstring de
`LectorPDT.leer` (`ingesta/persistence/lectores/pdt.py`) lo documenta
explícitamente — "CA-4 no tiene una regla propia: si el archivo no trae la
pestaña de metas, `resolver_hoja_pdt` ya lo rechaza (CA-2) — no hace falta
una heurística aparte para 'adivinar' que el archivo no corresponde". Subir
el archivo de ejecución en el paso del PDT y subir un PDT sin su pestaña
producen el mismo `codigo`/`motivo` y el mismo `error.message`
("«archivo.xlsx» no contiene la pestaña «Plan indicativo - Productos» del
Plan Indicativo."), que de hecho ya es válido para ambos casos.

**Alternativa descartada:** pedir al backend que separe CA-4 en su propio
`motivo` mediante una heurística que intente clasificar qué otro tipo de
archivo fue cargado. El CA-4 aprobado establece que el archivo que no
corresponde al formato esperado de PDT debe rechazarse sin intentar adivinar
su contenido. Introducir esa clasificación agregaría una regla no requerida
y podría contradecir expresamente ese criterio.

**A qué afecta:** `frontend/src/pages/NuevoCorte.jsx` (paso 2, carga del
PDT) — no requiere ningún cambio en `Estados.jsx`/`cliente.js` más allá de
lo que ya hacían (mostrar `error.message` + el desglose de `detalles`
conocidos).

**Estado:** DECISIÓN RATIFICADA — el equipo confirmó que el comportamiento
actual, que rechaza el archivo por no cumplir la estructura esperada del PDT
sin intentar clasificar qué tipo de archivo fue cargado, es consistente con
CA-4. Por tanto, `[HU-02][FE-02]` no debe fabricar un tercer mensaje ni
introducir una heurística de detección en frontend o backend.

**Quién y cuándo:** Juan Esteban, 2026-09-20. Ratificada por el equipo,
2026-09-20.

---

## D16 · `[HU-04][FE-03]`: `ResultadoLectura.codigos` se deduplica por `.valor`, preservando el orden de primera aparición

**Decisión:** el nuevo campo `codigos: list[CodigoIndicadorProducto]`
(`ResultadoLectura`/`ArchivoFuente`, mismo patrón que `descartes` de D14)
se llena en `LectorProyectos.leer()` deduplicando por `.valor` con un
diccionario (no un `set`), preservando el orden en que cada código
apareció por primera vez en el archivo.

**Motivo:** `[HU-04][FE-03]` pide, con texto literal, "vista previa de
códigos extraídos **y** descartados, con el motivo". PR #79/#82 ya
cerraron la mitad de `descartes` (D14); faltaba la mitad de los códigos
que sí se reconocieron. El mismo código de indicador aparece
legítimamente en varias filas/proyectos del archivo de Proyectos (no es
un error, es información real del dominio — ver test
`test_indicador_con_codigos_repetidos_no_los_deduplica`, que cubre la
repetición DENTRO de una celda). Exponer esa lista sin deduplicar
convertiría la vista previa en un log de apariciones, no en una
confirmación de "qué reconoció el sistema" — que es el propósito de una
vista previa para la administradora. El orden de primera aparición, y no
un orden alfabético o de un `set` (que no lo garantiza), facilita que la
usuaria contraste la lista contra el Excel original.

**Alternativa descartada:** replicar el patrón de `descartes` sin
deduplicar (acumular cada ocurrencia con `.extend()`). Se descartó porque
`descartes` representa eventos distintos que merecen su propia fila con
motivo; `codigos` no tiene motivo por entrada, solo identifica qué se
reconoció.

**A qué afecta:** `ingesta/domain/contratos.py::ResultadoLectura.codigos`,
`cortes/domain/entidades.py::ArchivoFuente.codigos`,
`ingesta/persistence/lectores/proyectos.py::LectorProyectos.leer`,
`cortes/application/casos_uso.py::cargar_archivo`. La deduplicación ocurre
únicamente en el lector (Transform); `casos_uso.py` y `entidades.py`
propagan la lista tal cual, sin volver a deduplicar. Queda pendiente que
Juan David conecte `resultado.codigos` en el DTO de respuesta
(`ArchivoFuenteRespuestaParcial`, `router.py`) — su parte ya está
diseñada contra `[]` y no depende de esta decisión.

**Estado:** DECISIÓN RATIFICADA. Propuesta original de Juan David
(diseño del campo, mismos 4 archivos que D14) con el detalle de
deduplicación y orden acordado explícitamente antes de escribir código.

**Quién y cuándo:** Juan David (propuesta), Juan Esteban (deduplicación
por orden de aparición), 2026-09-20.

---

## D17 · `[HU-07][FE-04]`: paginación visible en vez de virtualización, y método de verificación

**Decisión:** la tarjeta Trello `[HU-07][FE-04]` acepta explícitamente
"virtualización o paginación visible" para no renderizar miles de filas de
golpe. Se implementó PAGINACIÓN VISIBLE (controles "Anterior/Siguiente" en
`MatrizRelacion.jsx`, tamaño de página fijo de 50, igual al valor por
defecto del backend), no virtualización (p. ej. `react-window`).

**Motivo:** el corte de referencia real (D4) tiene 144 metas; incluso con el
fan-out de CA-7 (una meta con varios BPIN o contratos genera varias filas)
el volumen esperado es de cientos de filas por corte, no decenas de miles.
La paginación de 50 filas por página ya evita renderizar el total de golpe;
traer una librería de virtualización para ese volumen sería una dependencia
nueva sin beneficio medible. Si el volumen real de producción creciera en
órdenes de magnitud, esta decisión debe revisarse.

**Cómo se implementó "evitar re-renderizados completos al cambiar de
página" (requisito explícito de la tarjeta):** el componente conserva en
`matrizVisible` la última página cargada con éxito; la tabla y los controles
de paginación permanecen montados durante la carga de la página siguiente
(solo se deshabilitan los botones), en vez de reemplazar toda la sección por
el estado `Cargando`. Ese estado de pantalla completa solo aparece en la
carga inicial del corte, cuando todavía no hay ninguna fila que mostrar.

**Verificación:** no fue posible levantar Postgres desde el entorno donde se
implementó (sin Docker disponible en ese shell), así que la verificación
manual en navegador contra el corte real de Santa Rosa (el mismo volumen que
D4 documenta: 144 metas) queda PENDIENTE — a cargo de quien tenga el stack
local corriendo (`docker compose up -d`, backend + frontend, subir los tres
archivos reales del municipio y navegar la matriz resultante). Sí se
verificó: `npm run lint` y `npm run build` limpios, y una réplica aislada en
Node de la aritmética de paginación (`totalPaginas`, límites de los botones
Anterior/Siguiente) contra los volúmenes de D4 y el caso de fan-out de CA-7.
Mismo precedente que CA-3..CA-8 de esta pantalla (docs/TRAZABILIDAD.md): sin
framework de pruebas automatizadas de frontend en el repo, la verificación
funcional final es manual en navegador — no se agregó infraestructura de
pruebas de frontend en esta tarjeta (sería una decisión de arquitectura
propia que el equipo debe tomar explícitamente).

**Estado:** VIGENTE. Verificación manual en navegador con el corte real:
PENDIENTE.

**Registrado:** 2026-09-22.

---

## D18 · Rango válido de `vigencia`: hallazgo del QA manual y decisión de rango fijo

**Hallazgo:** durante la ejecución manual de `docs/QA_manual_sprint1.md`
(2026-09-23) se detectó que `vigencia` no tenía ninguna validación de rango
en ninguna de las tres capas donde aparece: el input de React
(`NuevoCorte.jsx`, `type="number"` sin `min`/`max`), el esquema Pydantic de
la API (`CorteEntrada`/`CorteCorreccion`, `vigencia: int` sin `Field`) ni el
dominio (`Corte`/`entidades.py`, sin invariante). Esto es exactamente lo que
permitió, al inicio de este sprint, crear un corte con `vigencia=1` en vez
de `2026`: el sistema lo aceptó sin objeción y el error solo se manifestó
mucho después, al leer el Excel, con un mensaje de "columnas faltantes" que
no menciona la vigencia como causa real.

**Alternativas presentadas al equipo:**

1. Rango fijo y simple (`2000 ≤ vigencia ≤ 2100`) validado en el dominio.
2. Rango relativo a la fecha del sistema (p. ej. año actual −10 a +1) — más
   preciso, pero acopla esta regla a `hoy` y exige definir la ventana exacta.
3. Solo ayuda visual en el frontend (`min`/`max` en el input), sin tocar el
   backend — descartada de entrada: las reglas de seguridad del proyecto
   exigen que el backend sea la autoridad, nunca solo la UI.

**Decisión:** opción 1. Se agrega `Corte.validar_vigencia` (dominio,
`VIGENCIA_MINIMA = 2000`, `VIGENCIA_MAXIMA = 2100`), invocada desde
`ServicioCortes.crear_corte` y desde `Corte.corregir` — mismo punto de
entrada que ya usa `Corte.validar_fecha` para CA-2. El frontend recibe
`min`/`max` + `placeholder="Ej: 2026"` en el input como ayuda de UX, no como
mecanismo de rechazo.

**Corrección durante la implementación:** la propuesta inicial incluía
además un `Field(ge=2000, le=2100)` en los esquemas Pydantic de la API
(`CorteEntrada`/`CorteCorreccion`). Se descartó al revisar
`app/core/errores.py`: solo traduce subclases de `GovSyncError` al sobre
`{codigo, mensaje, detalles}` que espera el frontend
(`api/cliente.js::ErrorApi`); un error de validación de Pydantic no pasa por
ahí y responde con la forma nativa de FastAPI (`{"detail": [...]}"`), que el
frontend no reconoce y cae al mensaje genérico de repuesto, perdiendo el
detalle accionable. Validar solo en el dominio evita esa inconsistencia y
reutiliza el mecanismo ya probado de `ReglaDeNegocioViolada`.

**Motivo:** mismo patrón que D9/D11 — la regla vive en el dominio, no en el
esquema de transporte, para que su comportamiento (mensaje, código HTTP,
forma del error) sea uniforme sin importar qué endpoint la dispare.

**Alternativas de implementación consideradas:** validar en `__post_init__`
del dataclass `Corte` — descartada porque correría también al reconstruir
un `Corte` ya persistido (p. ej. filas antiguas con una vigencia inválida
que alguien ya corrigió a mano en la base de datos, o fixtures de otros
entornos), rompiendo la lectura de datos existentes en vez de solo
rechazar datos nuevos.

**Pruebas:** `test_cortes.py::test_validar_vigencia_rechaza_fuera_de_rango_con_motivo`,
`::test_validar_vigencia_acepta_limites_inclusive`,
`TestCorregir::test_rechaza_corregir_con_vigencia_fuera_de_rango`;
`test_casos_uso_cortes.py::test_crear_corte_rechaza_vigencia_fuera_de_rango_sin_persistir_nada`.

**Estado:** VIGENTE.

**Registrado:** 2026-09-23.

---

## D19 · Se adopta Tailwind CSS para las pantallas nuevas del frontend

**Decisión:** a partir de esta tarjeta (estilo visual de Login y Nuevo
corte), el frontend usa Tailwind CSS para las pantallas y componentes que
se construyan o restilicen de aquí en adelante. Las pantallas y
componentes ya existentes antes de esta fecha (`Estados.jsx`,
`VistaPreviaDescartes.jsx`, la tabla de `MatrizRelacion.jsx`) **no se
migran** solo por consistencia cosmética — siguen con las clases BEM de
`estilos.css`. Los tokens de color/radio/tipografía que ya vivían como
variables CSS en `:root` se actualizaron a la paleta de la guía de estilo
recibida, así esos componentes heredan los mismos colores sin tocar su
JSX (ver comentario al inicio de `estilos.css`).

**Motivo:** `estilos.css` documentaba explícitamente la decisión contraria
("agregar Tailwind o MUI sería peso sin beneficio para cuatro pantallas").
Esa decisión fue razonable cuando el alcance era 4 pantallas sin guía de
diseño. Cambia el contexto: (1) la guía de estilo que el equipo recibió
está escrita en su totalidad como clases utilitarias de Tailwind — traducir
cada valor arbitrario a mano (`text-[#1A3A6B]`, `tracking-[0.12em]`,
`w-[42%]`) a CSS plano es más lento y con más riesgo de desviarse del
pixel-spec; (2) hay un dashboard con más pantallas planeado a futuro, y
adoptar Tailwind ahora (2 pantallas) es más barato que migrar después con
10+ pantallas ya escritas en CSS plano.

**Alternativas consideradas:** traducir la guía a CSS plano extendiendo
`estilos.css` con el mismo patrón BEM — descartada por el punto (2)
anterior; se prefirió no posponer la migración a un momento con más
superficie de código que reescribir.

**Costo aceptado:** el frontend queda con dos sistemas de estilos
coexistiendo (Tailwind en pantallas nuevas, CSS plano en las anteriores)
hasta que alguien decida migrar el resto — no forma parte de esta
tarjeta.

**Estado:** PROPUESTA — implementada directamente por no bloquear la
tarjeta de estilo visual, pendiente de que el equipo la ratifique como las
demás decisiones de arquitectura de este documento.

**Registrado:** 2026-09-21, Cristhian (`CrisCamUO`).

---

## D20 · Sidebar AppShell + átomos compartidos, adaptados de `DESIGN_SPEC.md` (mockup Figma Make), sin RBAC

**Decisión:** se reemplazó la barra superior simple de `Disposicion.jsx`
por un sidebar fijo (`w-52`, navy) siguiendo `DESIGN_SPEC.md` §4.1, y se
extrajeron los átomos que ese documento lista en su §7 como base a portar
primero: `Card`, `SectionHeader`, `StateBadge`, `SemaforoDot`, `PctCell`
(en `components/shared/`) y el helper `cop()` (`lib/formato.js`). Se
aplicaron a las cuatro pantallas que ya existen en el sprint — Login,
Nuevo corte, Cortes, Matriz de relación —, no a las pantallas nuevas que
describe el documento (Tablero, Conciliación, Avance físico, Gestión de
usuarios), que **no se construyeron**.

**Motivo:** `DESIGN_SPEC.md` es la documentación de un mockup de Figma Make
más grande que el alcance de este sprint — describe una app completa con
RBAC por rol y seis pantallas. `PLANDETRABAJO.md` no tiene tarjeta para
ninguna de esas seis pantallas ni para roles/autenticación (siguen bajo
D2/`[REF-05]`, diferidos a Sprint 2). Construirlas ahora habría significado
UI sin backend ni datos reales que las respalden, y un menú de navegación
filtrado por un rol que el sistema todavía no modela. El usuario confirmó
explícitamente este recorte antes de empezar (tokens + átomos + sidebar,
sin las pantallas nuevas ni RBAC).

**Qué SÍ se llevó del documento:** los tokens de color adicionales
(`semaforo.*`, `chart.*`, `navy.sidebar`, `secundario`) en
`tailwind.config.js`; el patrón de tabla universal (§4.4: `thead` gris,
texto `10px` uppercase, filas con hover, celdas numéricas en `font-mono`)
aplicado a `Cortes.jsx` y `MatrizRelacion.jsx`, que antes no tenían ningún
estilo real (sus clases `.historico-cortes`/`.cortes-tabla`/`.apagado`
nunca tuvieron CSS definido); el patrón de encabezado de pantalla
persistente (§4.2: título+subtítulo visibles incluso en estados de
carga/error), que antes no existía — `Cortes.jsx` y `MatrizRelacion.jsx`
retornaban solo el estado de carga/error sin encabezado.

**Qué NO se llevó (deliberado):** `NAV_BY_ROLE`/roles, las seis pantallas
nuevas, Recharts (no hay gráficos en este sprint), shadcn/ui (no se
evaluó; el layout actual son cuatro pantallas y una tabla, no justifica
otra dependencia de componentes todavía). `SemaforoDot` y `PctCell` se
crearon sin consumidor real hoy — quedan documentados en su propio
comentario como átomos listos, no como código muerto accidental.

**Riesgo aceptado:** dos átomos (`SemaforoDot`, `PctCell`) no tienen
ninguna pantalla que los use todavía; si para cuando exista una tarjeta
real que los necesite el diseño final terminó siendo distinto, se
descartan sin costo (son ~20 líneas cada uno).

**Estado:** PROPUESTA — mismo criterio que D19, pendiente de ratificación
del equipo.

**Registrado:** 2026-09-21, Cristhian (`CrisCamUO`).

---

## D21 · `/cortes/:corteId` reanuda un corte en BORRADOR desde el frontend

**Hallazgo (2026-09-21, probando el flujo de punta a punta):** un corte
creado y abandonado a mitad del wizard (por ejemplo, cerrando la pestaña
tras el paso 1) quedaba huérfano. El backend ya soporta retomarlo por id
(`GET /cortes/{id}`, y `POST /cortes/{id}/archivos/{tipo}` /
`POST /cortes/{id}/registrar` funcionan contra cualquier corte en
BORRADOR existente), pero el frontend no tenía ningún punto de entrada
para hacerlo: `NuevoCorte.jsx` solo sabía crear un corte nuevo, y
`Cortes.jsx` mostraba los BORRADOR como texto plano ("En borrador"), sin
enlace. No estaba anotado como pendiente en `PLANDETRABAJO.md` ni en este
documento — a diferencia de RBAC/autenticación (D2), que sí están
diferidos a propósito, este era un hueco no advertido.

**Decisión:** `NuevoCorte.jsx` se monta también en la ruta
`/cortes/:corteId` (además de `/cortes/nuevo`). Con `corteId` en la URL,
en vez de mostrar el formulario de creación, hace `GET /cortes/{id}` y
entra directo a la vista de carga de archivos con el corte ya existente
— mismo componente, misma lógica de `subirPdt`/`subirProyectos`/
`subirEjecucion`/`manejarRegistro`, sin duplicar nada. `Cortes.jsx` ahora
enlaza "Continuar carga" a esa ruta para cualquier corte en BORRADOR.

**Por qué reusar el mismo componente en vez de crear uno nuevo:** la
vista de "cargar archivos del corte" (paso 2 del wizard) ya es idéntica
para un corte recién creado o uno recuperado — ambos casos solo necesitan
un objeto `corte` con `id`/`vigencia`/`fecha_corte`/`estado`/`archivos`.
Separar esto en dos componentes hubiera duplicado ~150 líneas de JSX y
las tres funciones de subida.

**Efecto secundario encontrado y corregido en el mismo cambio:** al
razonar sobre las rutas se encontró que el `NavLink` de "Cortes" en el
sidebar (`Disposicion.jsx`) no tenía `end`, así que se resaltaba también
en `/cortes/nuevo` y ahora se resaltaría en `/cortes/:id` — dos ítems del
menú activos a la vez. Se agregó `end` a ese `NavLink`. Costo aceptado:
mientras se reanuda un borrador (`/cortes/:id`), ningún ítem del menú
queda resaltado — se prefirió eso a inventar una regla de coincidencia
custom para un caso de uso secundario.

**Probado manualmente de punta a punta** (backend + Postgres + frontend
reales, sin mocks): corte creado y abandonado en BORRADOR → `Cortes.jsx`
lo lista con "Continuar carga" → `/cortes/:id` lo carga con sus fuentes
reutilizadas/pendientes intactas → se sube la fuente faltante → se
registra con éxito → aparece en el histórico como REGISTRADO. También se
probó el camino de error: un id con formato inválido cae en el 422
genérico de FastAPI (mismo comportamiento que ya tenía `/matriz/:corteId`
para el mismo caso, no es nuevo de esta tarjeta); un UUID válido pero
inexistente muestra el 404 específico del dominio
(`codigo: recurso_no_encontrado`) con su mensaje, gracias a
`EstadoError`.

**Estado:** IMPLEMENTADA — cierra un hueco real, no una decisión de
alcance a ratificar.

**Registrado:** 2026-09-21, Cristhian (`CrisCamUO`).

---

## D22 · Columnas faltantes en PDT/Ejecución, dos reglas de negocio nuevas en la matriz, y definición de filtros

**Hallazgo (2026-09-23, revisión de columnas pedida por el equipo):**
comparando la lista de columnas de PDT/Ejecución/Proyectos contra el
código, se encontraron: (1) columnas del PDT nunca extraídas (metadato del
plan, jerarquía MGA completa, ODS); (2) `NombreSectorCcpet` de Ejecución
nunca extraída (solo el código); (3) tres columnas ya modeladas en
`MetaORM` y ya leídas por `repositorios.py::reemplazar_metas`
(`cod_indicador_sistp`, `codigo_producto_mga`, `bpin_relacionados`) que el
lector del PDT nunca poblaba — la tubería existía, faltaba la extracción;
(4) dos reglas de negocio (`Tipo Gasto = INVERSIÓN`, `CodigoSectorCcpet ≠
vacío/NA`) que el equipo esperaba pero no estaban en ningún CA aprobado ni
en el código. Detalle completo por columna en `docs/DATOS.md` (nuevo,
también cierra ese hallazgo — el archivo era referenciado por `pdt.py`/
`ejecucion.py`/`proyectos.py`/`_comun.py` desde el inicio del sprint sin
existir nunca).

**Decisiones tomadas, una por hallazgo:**

1. **Columnas nuevas del PDT** (`pdt.py::OPCIONALES`, `MetaORM`,
   `repositorios.py::reemplazar_metas`, migración `122e94509b80`):
   `entidad_territorial`, `nombre_plan`, `fecha_creacion_plan` (metadato
   del plan, repetido por fila — no se creó una tabla `plan` aparte, ver
   razonamiento en el comentario de `pdt.py`), `linea_estrategica`,
   `codigo_sector`/`sector`, `codigo_programa`/`programa`, `codigo_ods`/
   `ods`, `tipo_acumulacion` (propias de cada meta). Todas opcionales — no
   rechazan el archivo si faltan, mismo criterio que `nombre_producto`.
2. **`NombreSectorCcpet`** (`ejecucion.py::OPCIONALES_RUBRO`, `RubroORM`,
   misma migración): agregada junto al código que ya existía.
3. **Columnas fantasma corregidas**: `cod_indicador_sistp` (columna real
   confirmada: "Código de indicador de producto (SisPT)" — NO es llave de
   cruce, ver `shared/codigos.py`, solo diagnóstico) y `codigo_producto_mga`
   (SUPUESTO sin confirmar, ver `docs/DATOS.md` §5) ahora se extraen en
   `pdt.py`. `bpin_relacionados` **sigue sin poblarse**: a diferencia de
   las otras dos, no hay ningún nombre de columna real identificado en el
   PDT para un BPIN relacionado — inventar un alias sin evidencia
   fabricaría un mapeo que nunca coincidiría, o peor, coincidiría con la
   columna equivocada. Queda como pregunta abierta en `docs/DATOS.md`.
4. **`no muevas eso, el indicador y unidad de medida es el mismo`** (dato
   del equipo, 2026-09-23): confirmado y dejado explícito en el comentario
   de `pdt.py::OPCIONALES` — "Indicador de Producto(MGA)" sigue mapeando a
   `unidad_medida`, no se toca.
5. **`docs/DATOS.md` creado**: consolida anatomía real de las tres fuentes,
   qué se extrae/persiste/expone en la matriz por columna, y las preguntas
   abiertas (columnas sin confirmar).
6. **Matriz (HU-07) — contenido + reglas + filtros**, a pedido explícito
   del equipo ("incluye solo lo necesario para ver que se hizo bien el
   cruce... agrega presupuesto pero no tan detallado, lo general"):
   - **Dos reglas de negocio nuevas**, aplicadas DENTRO del JOIN (mismo
     patrón que la Regla 1 de `ultimo_nivel`, nunca en un WHERE posterior
     — ver docstring de `consultas.py::_construir_consulta_base`): un
     rubro con `CodigoSectorCcpet` vacío o "NA" no cruza; un contrato sin
     `Tipo Gasto = INVERSIÓN` no cruza (con o sin tilde).
   - **`presupuesto_apropiado`** agregado a `FilaMatriz`/
     `FilaMatrizRespuesta`/`MatrizRelacion.jsx`: un solo monto general (la
     apropiación definitiva del rubro cruzado), no las cinco columnas
     financieras de `Rubro` — la matriz es para verificar el cruce
     visualmente, no un reporte financiero.
   - **Columna "Estado" agregada en el frontend** (`estadoDeFila`,
     `MatrizRelacion.jsx`): resume si la meta cruzó con las tres fuentes
     ("Completo", verde), con ninguna ("Sin cruce", gris) o con algunas
     ("Parcial", ámbar) — computado en el cliente a partir de los mismos
     tres campos de correspondencia que ya viajaban, sin campo nuevo del
     backend para esto.
   - **Filtros implementados**: `estado_cruce` (`completo`/`sin_proyecto`/
     `sin_ejecucion`/`sin_contrato`/`sin_cruce`) y `busqueda` (texto libre
     sobre código de indicador, BPIN o número de contrato) —
     `GET /matriz-relacion/{id}?estado_cruce=...&busqueda=...`, aplicados
     ANTES de paginar (afectan `total`/`totalPaginas`, no la página ya
     traída). Selector + campo de texto en la pantalla, con debounce de
     400ms en la búsqueda.
   - **Filtros definidos pero NO implementados** (propuesta para una
     tarjeta futura, si el equipo los quiere):
     - _Por sector_ (`codigo_sector_ccpet`/`nombre_sector_ccpet`, ya
       persistidos): útil ahora que `NombreSectorCcpet` se extrae.
     - _Por línea estratégica_ (`meta.linea_estrategica`, agregada en esta
       misma tarjeta): agrupa metas por la misma línea del plan.
     - _"Con/sin presupuesto asignado"_: sobre `presupuesto_apropiado`
       IS/IS NOT NULL — más simple que un rango numérico, y cubre el caso
       real de uso ("¿qué metas con ejecución no tienen apropiación
       registrada?").
     - _Rango de presupuesto_ (mínimo/máximo): se dejó fuera de la primera
       tanda por ser el que menos valor visual aporta frente a su costo de
       UI (dos inputs numéricos + validación de rango) comparado con los
       otros tres.
     - _Por BPIN específico o por número de contrato exacto_ (no
       `busqueda` parcial): no se implementó porque `busqueda` ya cubre
       este caso vía coincidencia parcial (`ILIKE`), y un filtro exacto
       aparte sería redundante sin un caso de uso que lo distinga.

**Verificación:** `pytest` (nuevas pruebas dedicadas por regla: sector
vacío/NA no cruza, sector válido sí cruza, tipo de gasto distinto de
INVERSIÓN no cruza, con/sin tilde, cada valor de `estado_cruce`, cada
campo de `busqueda`, extracción de las columnas nuevas de PDT/Ejecución
con un workbook armado a mano) + `ruff check`/`format` limpios + migración
`122e94509b80` generada con `alembic revision --autogenerate` y aplicada
contra Postgres real. Frontend: `npm run build`/ESLint limpios, y
verificación manual en navegador contra el stack real (Postgres, FastAPI y
Vite): los tres filtros (`sin_proyecto`, `sin_ejecucion`, `completo`,
`busqueda`) probados con datos reales que cruzan mixto, confirmando que
antes de esta tarjeta ninguna regla de sector/tipo de gasto se aplicaba.

**Nota operativa (no relacionada con el código):** durante la
verificación se encontró que `lsof`/`ps` de Git Bash no ven procesos de
Windows — un backend/frontend de sesiones anteriores de este mismo
entorno de desarrollo quedó "zombi" ocupando los puertos 8000/5173 durante
varias horas, haciendo que reinicios aparentes del servidor siguieran
sirviendo código viejo silenciosamente. Se resolvió matando los procesos
por PID vía PowerShell (`Get-NetTCPConnection`/`Stop-Process`). Queda como
advertencia para cualquiera que verifique cambios de backend manualmente
en este entorno: confirmar con `curl .../openapi.json` que el esquema
refleja el código actual antes de dar una prueba manual por buena.

**Estado:** IMPLEMENTADA (puntos 1-6, filtros `estado_cruce`/`busqueda`) —
PROPUESTA (filtros adicionales del punto 6, pendientes de que el equipo
decida cuáles construir).

**Registrado:** 2026-09-23, Cristhian (`CrisCamUO`).
