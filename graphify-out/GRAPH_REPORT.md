# Graph Report - govsync  (2026-09-09)

## Corpus Check
- 92 files · ~35,412 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 581 nodes · 692 edges · 73 communities (33 shown, 12 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dd14305a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Especificaciones técnicas — Historias de Usuario del Sprint 1
- Plan de trabajo — Sprint 1
- env.py
- package.json
- ResultadoLectura
- RepositorioCortes
- What You Must Do When Invoked
- Corte
- _comun.py
- frontend/package.json
- CLAUDE.md
- devDependencies
- test_arquitectura.py
- test_casos_uso_cortes.py
- errores.py
- CodigoIndicadorProducto
- RepositorioDatosCorteEnMemoria
- fabricas.py
- ServicioCortes
- graphify reference: extra exports and benchmark
- Matriz / Plan de Casos de Prueba — GovSync
- Decisiones de diseño y alcance — GovSync
- Trazabilidad HU → CA → Código → Prueba — Sprint 1
- Seguridad — checklist OWASP y específico de GovSync
- graphify reference: query, path, explain
- Documentación con Swagger (OpenAPI)
- pull_request_template.md
- consultas.py
- Estados.jsx
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- cliente.js
- App.jsx
- historia_usuario.md
- test_salud.py
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- cortes/api/router.py
- trazabilidad/api/router.py
- graphify
- extraction-spec.md
- commit-msg
- pre-commit
- govsync-backend

## God Nodes (most connected - your core abstractions)
1. `Corte` - 30 edges
2. `RepositorioCortes` - 17 edges
3. `Plan de trabajo — Sprint 1` - 17 edges
4. `RepositorioDatosCorte` - 15 edges
5. `ResultadoLectura` - 13 edges
6. `RepositorioCortesEnMemoria` - 13 edges
7. `LectorArchivoFuente` - 12 edges
8. `What You Must Do When Invoked` - 12 edges
9. `ServicioCortes` - 11 edges
10. `TipoArchivoFuente` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ServicioCortes` --uses--> `Corte`  [INFERRED]
  backend/app/modules/cortes/application/casos_uso.py → backend/app/modules/cortes/domain/entidades.py
- `ServicioCortes` --uses--> `RepositorioCortes`  [INFERRED]
  backend/app/modules/cortes/application/casos_uso.py → backend/app/modules/cortes/domain/puertos.py
- `ServicioCortes` --uses--> `RepositorioDatosCorte`  [INFERRED]
  backend/app/modules/cortes/application/casos_uso.py → backend/app/modules/cortes/domain/puertos.py
- `servicio()` --uses--> `ServicioCortes`  [INFERRED]
  backend/tests/test_casos_uso_cortes.py → backend/app/modules/cortes/application/casos_uso.py
- `RepositorioCortesEnMemoria` --uses--> `EstadoCorte`  [INFERRED]
  backend/tests/test_casos_uso_cortes.py → backend/app/modules/cortes/domain/entidades.py

## Import Cycles
- None detected.

## Communities (73 total, 12 thin omitted)

### Community 0 - "Especificaciones técnicas — Historias de Usuario del Sprint 1"
Cohesion: 0.05
Nodes (38): Comportamiento ante error, Comportamiento ante error, Comportamiento ante error, Comportamiento ante error, Comportamiento ante error, Endpoint y método, Endpoint y método, Endpoint y método (+30 more)

### Community 1 - "Plan de trabajo — Sprint 1"
Cohesion: 0.06
Nodes (35): 1.1 `[TRANS-01]` Objeto de valor CodigoIndicador — **Cristhian**, 1.2 `[BD-01]` Modelo de dominio y migración inicial — **Cristhian**, 1.3 `[UX-01]` Layout, enrutamiento y cliente HTTP — **Karold**, 1.4 `[DEV-04]` `[DEV-05]` Pipeline CI — **Cristhian**, 1. Reglas del juego, 2. Reparto, 3.0 `[SEC-03]` Validador transversal de archivos — **Cristhian** (primero), 3.1 HU-02 · Plan Indicativo (+27 more)

### Community 2 - "env.py"
Cohesion: 0.09
Nodes (22): Configuración de Alembic. Toma la URL de la base de la configuración de la app.…, get_settings(), Configuración central de GovSync. Capa: núcleo transversal. No contiene reglas…, Settings, Base, get_session(), Session, Sesión SQLAlchemy y Base declarativa. Capa: persistencia (infraestructura). El… (+14 more)

### Community 3 - "package.json"
Cohesion: 0.07
Nodes (29): dependencies, tar, description, license, lint-staged, backend/**/*.py, frontend/**/*.{js,jsx}, *.{json,md,css,html,yml,yaml,js,cjs,mjs} (+21 more)

### Community 4 - "ResultadoLectura"
Cohesion: 0.14
Nodes (19): LectorArchivoFuente, ABC, Contratos (puertos) de la ingesta de archivos fuente. CAPA: Dominio TARJETAS:…, Salida de Extract+Transform, antes de la etapa Load. Si el lector no pudo…, Conteo que se muestra a la administradora (HU-02/CA-5)., Estrategia de lectura de un tipo de archivo fuente., Extrae y transforma. Lanza ArchivoInvalido si el archivo no aplica., ResultadoLectura (+11 more)

### Community 5 - "RepositorioCortes"
Cohesion: 0.13
Nodes (16): Casos de uso del módulo de cortes. CAPA: Aplicación TARJETAS: [HU-01][BE-03]…, ArchivoFuente, ABC, Any, UUID, Puertos (interfaces de repositorio) del módulo de cortes. CAPA: Dominio…, Registra o REEMPLAZA el archivo de ese tipo (HU-06: corregir carga)., Persistencia de los datos extraídos de los archivos fuente (etapa Load). Todas… (+8 more)

### Community 6 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 7 - "Corte"
Cohesion: 0.11
Nodes (10): Corte, HU-01/CA-3 y CA-4: transición BORRADOR -> REGISTRADO. Si falta algún archivo…, HU-01/CA-7: el archivo de ejecución nunca se reutiliza., Agrupación de fuentes y resultados de un momento de seguimiento., Tipos obligatorios que aún no están cargados ni reutilizados., Persiste un corte nuevo (siempre en estado BORRADOR)., Corte REGISTRADO más reciente. Base de la reutilización (CA-5)., Histórico de cortes, del más reciente al más antiguo (CA-4). (+2 more)

### Community 8 - "_comun.py"
Cohesion: 0.09
Nodes (23): abrir_libro(), exigir_columnas(), leer_hoja(), localizar_fila_encabezado(), mapear_columnas(), normalizar_encabezado(), numero(), Utilidades compartidas por los lectores de Excel. CAPA: Persistencia… (+15 more)

### Community 9 - "frontend/package.json"
Cohesion: 0.08
Nodes (23): dependencies, react, react-dom, react-router-dom, devDependencies, eslint, prettier, @vitejs/plugin-react (+15 more)

### Community 10 - "CLAUDE.md"
Cohesion: 0.10
Nodes (17): Architecture, Commands, Conventions, graphify, Project, Ejemplo, Estructura, Estándar de Ramas (+9 more)

### Community 11 - "devDependencies"
Cohesion: 0.10
Nodes (21): @commitlint/cli, @commitlint/config-conventional, @eslint/js, eslint-plugin-react, eslint-plugin-react-hooks, globals, husky, lint-staged (+13 more)

### Community 12 - "test_arquitectura.py"
Cohesion: 0.17
Nodes (19): _archivos(), _importa_capa(), _modulos_importados(), Pruebas de arquitectura: la regla de dependencias es ejecutable, no un acuerdo…, Sin SQL ni ORM en los routers: la API traduce HTTP, no consulta datos., Pandas y openpyxl solo pueden aparecer bajo `persistence/`., Un módulo puede usar el dominio de otro, pero no sus repositorios. Excepción…, Guarda contra un falso verde si la estructura de carpetas cambia. (+11 more)

### Community 13 - "test_casos_uso_cortes.py"
Cohesion: 0.18
Nodes (14): EstadoCorte, date, Entidades y reglas de negocio del módulo de cortes. CAPA: Dominio TARJETA:…, HU-01/CA-2: no se aceptan cortes con fecha futura., TipoArchivoFuente, ReglaDeNegocioViolada, Pruebas del caso de uso CrearCorte (aplicacion), sin base de datos. TARJETA:…, test_crear_corte_queda_en_borrador_con_los_tres_archivos_faltantes() (+6 more)

### Community 14 - "errores.py"
Cohesion: 0.24
Nodes (12): FastAPI, Traducción centralizada de errores de dominio a respuestas HTTP. Capa: API. Es…, registrar_manejadores(), ArchivoInvalido, CredencialesInvalidas, GovSyncError, OperacionNoPermitida, Excepciones de dominio compartidas. Capa: dominio. Sin dependencias de… (+4 more)

### Community 15 - "CodigoIndicadorProducto"
Cohesion: 0.15
Nodes (7): CodigoBpin, CodigoIndicadorProducto, Objetos de valor de códigos de dominio. CAPA: Dominio (kernel compartido)…, Código de 9 dígitos que identifica un indicador de producto., Normaliza un valor de Excel. Devuelve None si no es un código válido., Separa los indicadores multivalor de una sola celda (HU-04/CA-4). La celda real…, Código BPIN de 15 dígitos.

### Community 16 - "RepositorioDatosCorteEnMemoria"
Cohesion: 0.22
Nodes (6): Any, fixture, UUID, No se ejercita en estas pruebas: crear_corte y listar_cortes no lo usan., RepositorioDatosCorteEnMemoria, servicio()

### Community 17 - "fabricas.py"
Cohesion: 0.20
Nodes (9): _a_bytes(), construir_ejecucion(), construir_pdt(), construir_proyectos(), Generadores de libros de Excel para las pruebas. TARJETA: [DEV-05] · usado por…, PDT válido, o una variante sin una columna obligatoria (HU-02/CA-3)., Archivo presupuestal válido, o sin alguna pestaña (HU-03/CA-4)., Plantilla con celdas combinadas y un indicador multivalor (HU-04/CA-4). (+1 more)

### Community 18 - "ServicioCortes"
Cohesion: 0.25
Nodes (4): date, HU-01 / CA-1, CA-8. La validacion de fecha futura (CA-2) se delega al dominio,…, HU-02, HU-03, HU-04 y HU-06 (reemplazo del archivo)., ServicioCortes

### Community 19 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 20 - "Matriz / Plan de Casos de Prueba — GovSync"
Cohesion: 0.22
Nodes (8): HU-01 · Crear un corte indicando vigencia y fecha exacta, HU-02 · Cargar el archivo del Plan Indicativo (PDT), HU-03 · Cargar el archivo presupuestal (ejecución y contratación), HU-04 · Cargar la plantilla de proyectos BPIN, HU-07 · Visualizar la matriz de relación del corte, Leyenda de Estado, Matriz / Plan de Casos de Prueba — GovSync, Resumen de cobertura (Sprint 1, a la fecha de este documento)

### Community 21 - "Decisiones de diseño y alcance — GovSync"
Cohesion: 0.22
Nodes (8): D1 · La migración de Alembic es la única fuente de verdad del esquema, D2 · Autenticación (E-01) diferida al Sprint 2, D3 · Qué archivo es "el archivo del municipio" en HU-01/CA-5, D4 · Corte de referencia para medir los atributos de rendimiento (Tabla 7, Entrega 1), D5 · Reconciliación de numeración de CA entre Excel y Trello (HU-01, HU-07), D6 · Reconciliación de numeración de CA entre Excel, Trello y PLANDETRABAJO.md (HU-02, HU-03, HU-04), D7 · La entidad Corte tiene dos estados: BORRADOR y REGISTRADO, Decisiones de diseño y alcance — GovSync

### Community 22 - "Trazabilidad HU → CA → Código → Prueba — Sprint 1"
Cohesion: 0.25
Nodes (7): Cómo llenar esta tabla, E-02 / HU-01 — Crear corte de seguimiento (8 SP), E-02 / HU-02 — Cargar Plan Indicativo (3 SP), E-02 / HU-03 — Cargar información presupuestal y contractual (8 SP), E-02 / HU-04 — Cargar plantilla de proyectos BPIN (13 SP), E-02 / HU-07 — Visualizar matriz de relación del corte (5 SP), Trazabilidad HU → CA → Código → Prueba — Sprint 1

### Community 23 - "Seguridad — checklist OWASP y específico de GovSync"
Cohesion: 0.29
Nodes (6): CORS, Específico de GovSync — validación de archivos cargados (`[SEC-03]`), Exposición de errores internos, Manejo de secretos, Seguridad — checklist OWASP y específico de GovSync, Tabla 4 de la rúbrica — OWASP Top 10

### Community 24 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 25 - "Documentación con Swagger (OpenAPI)"
Cohesion: 0.33
Nodes (5): Documentación con Swagger (OpenAPI), Patrón por endpoint, Puntos clave, Registrar un módulo nuevo, Regla del equipo

### Community 26 - "pull_request_template.md"
Cohesion: 0.33
Nodes (5): Checklist, Código asistido por IA, Descripción, Issue relacionado, Tipo de cambio

### Community 27 - "consultas.py"
Cohesion: 0.50
Nodes (4): construir_matriz(), Session, UUID, Construcción de la matriz de relación. CAPA: Persistencia TARJETAS:…

### Community 28 - "Estados.jsx"
Cohesion: 0.60
Nodes (4): Error(), etiquetaGenerica(), ETIQUETAS_DETALLE_CONOCIDAS, listarDetalles()

### Community 29 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 30 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 31 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 34 - "historia_usuario.md"
Cohesion: 0.50
Nodes (3): Criterios de Aceptación, Descripción, Notas técnicas

## Knowledge Gaps
- **201 isolated node(s):** `govsync-backend`, `name`, `private`, `version`, `type` (+196 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 356 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Corte` connect `Corte` to `ServicioCortes`, `test_casos_uso_cortes.py`, `RepositorioCortes`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `ReglaDeNegocioViolada` connect `test_casos_uso_cortes.py` to `errores.py`, `Corte`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `Corte` (e.g. with `ServicioCortes` and `ReglaDeNegocioViolada`) actually correct?**
  _`Corte` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `RepositorioCortes` (e.g. with `ServicioCortes` and `ArchivoFuente`) actually correct?**
  _`RepositorioCortes` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `RepositorioDatosCorte` (e.g. with `ServicioCortes` and `TipoArchivoFuente`) actually correct?**
  _`RepositorioDatosCorte` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `ResultadoLectura` (e.g. with `LectorEjecucion` and `LectorPDT`) actually correct?**
  _`ResultadoLectura` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `govsync-backend`, `name`, `private` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._