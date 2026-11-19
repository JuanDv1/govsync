# Sección 3 — Refinamiento de los ítems anteriores (Sprint 2)

> Estado verificado contra el repositorio el 2026-10-20 (rama `develop` / `origin/develop`).
> Cada afirmación cita un archivo, commit o PR. Lo que **no** se pudo comprobar desde el
> código queda marcado como **⚠️ Pendiente de evidencia** o **❌ No resuelto**, para no
> sobrestimar el avance.

## 3.1 Resumen de refinamiento y evolución

El Sprint 1 cerró con cuatro debilidades registradas: (1) `develop` sin protección, (2) 0 %
de pruebas en el frontend, (3) deuda técnica de SonarCloud (65 code smells, 28 de ellos
`pytest.raises` poco específicos y literales duplicados) y (4) pipeline sin staging y poco
resiliente.

En el Sprint 2 el avance fue desigual:

| Debilidad del Sprint 1      | Estado al 2026-10-20               | Resumen                                                                                                                                                         |
| --------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. `develop` sin protección | ⚠️ Parcial / sin evidencia en repo | Hay revisión obligatoria por `CODEOWNERS`, CI sobre PRs a `develop` y flujo 100 % por PR. La regla de protección de GitHub no es verificable desde el código.   |
| 2. Frontend 0 %             | ⚠️ Hecho en rama, no integrado     | Vitest + 4 archivos de prueba y cobertura en CI existen en `test/frontend-vitest`; **no están en `develop`**. En `develop`, `npm test` sigue sin ejecutar nada. |
| 3. 65 code smells           | ⚠️ Reducción parcial               | Se corrigieron hallazgos concretos de SonarCloud (backend, frontend, CI). Los `pytest.raises` sin `match=` siguen sin tocar (73 usos, 0 con `match=`).          |
| 4. Resiliencia del pipeline | ✅ Mejorado (sin staging)          | Despliegue encadenado tras pruebas y migración, reintentos, serialización, instalación con hashes y sin scripts. **No se creó ambiente de staging.**            |

Además, el sprint entregó mejoras de arquitectura y seguridad no previstas como compromiso:
autenticación/autorización con Keycloak (JWT RS256 validado contra JWKS), corte de subida por
streaming, lectura Excel en modo `read_only`, y filtros/exportación/comparación del Plan de
Acción con autorización por rol.

## 3.2 Mejoras realizadas desde el Sprint 1, por área

### DevOps / CI-CD

| #   | Mejora                                                            | Evidencia                                                                                                        | Estado |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| D1  | CI también sobre `develop` y re-apuntado de PRs (`edited`)        | `ci.yml` `on.pull_request.types: [opened, synchronize, reopened, edited]`; commits 261d689, ecf074f              | ✅     |
| D2  | Migración Alembic + despliegue encadenados tras las pruebas       | job `migrate-render` con `needs: [backend-calidad, backend-migraciones]`; commits 9921d7c, e01c46c               | ✅     |
| D3  | Resiliencia del despliegue (reintentos y serialización)           | `curl --retry 3 --retry-all-errors`; `concurrency: produccion-render, cancel-in-progress: false`; commit 5c4f2e7 | ✅     |
| D4  | Migraciones probadas en ida y vuelta contra Postgres 16 efímero   | job `backend-migraciones`: `upgrade → downgrade base → upgrade`                                                  | ✅     |
| D5  | Cadena de suministro: hashes y sin scripts de instalación         | `pip install --require-hashes --only-binary ":all:"`, `npm ci --ignore-scripts`; commits 3b85503, 6d72505        | ✅     |
| D6  | Acciones de terceros fijadas por hash; Dependabot (npm y actions) | `sonarqube-scan-action@d209202…`; `.github/dependabot.yml` (target `develop`); PRs #128, #129, #132              | ✅     |
| D7  | Escaneo SAST/calidad: SonarCloud + CodeQL                         | `ci.yml` job `sonarcloud` (reutiliza `coverage.xml`), `.github/workflows/codeql.yml`                             | ✅     |
| D8  | Branch protection en `develop`                                    | Ver §3.3.1                                                                                                       | ⚠️     |
| D9  | Ambiente de staging separado                                      | No existe: solo `docker-compose.yml` (local) y producción (Render + Vercel preview por PR)                       | ❌     |

### Calidad / Frontend

| #   | Mejora                                                      | Evidencia                                                                                                                                                                   | Estado |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Q1  | Vitest + pruebas de humo + cobertura en CI/Sonar            | Rama `test/frontend-vitest`: commits 15ba856 y 84327a1. **No integrada a `develop`**                                                                                        | ⚠️     |
| Q2  | Refactor para bajar complejidad cognitiva (hallazgos Sonar) | 4b943e0 (selector con búsqueda), 87bdc19 (hook de opciones), 9a5c977 (estado sin filas), 744a675                                                                            | ✅     |
| Q3  | Renombre `Error` → `EstadoError` (`javascript:S2137`)       | Commit 8ed43a7; `frontend/src/components/Estados.jsx`                                                                                                                       | ✅     |
| Q4  | Lógica de filtros extraída a módulo puro                    | `frontend/src/lib/filtros.js` (commit 1834338)                                                                                                                              | ✅     |
| Q5  | Ampliación de pruebas backend                               | 29 archivos en `backend/tests` (p. ej. `test_exportacion_excel_plan_accion.py`, `test_autorizacion_rutas.py`); commits 76ea7ef, 6f56df5; umbral `--cov-fail-under=70` en CI | ✅     |
| Q6  | Smells `pytest.raises` impredecibles / literales duplicados | 73 `pytest.raises` en `backend/tests`, **0 con `match=`**                                                                                                                   | ❌     |

### Backend / Arquitectura

| #   | Mejora                                                                        | Evidencia                                                                                               | Estado |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| A1  | Módulo `plan_accion` en 4 capas (consulta, filtros, exportación, comparación) | `app/modules/plan_accion/{api,domain,persistence}`; commits 6cb1e98, 3022702, e6a4884, 6f374b9, d515b0d | ✅     |
| A2  | Módulo `identidad` (puerto + adaptador Keycloak)                              | `identidad/domain/puertos.py`, `identidad/persistence/keycloak.py`                                      | ✅     |
| A3  | Reglas de capas ejecutables                                                   | `tests/test_arquitectura.py` (falla el build si se violan)                                              | ✅     |
| A4  | Reemplazo de archivos del corte actual                                        | commits 1b9908d, 053a579; spec `E02-HU05`                                                               | ✅     |
| A5  | Corrección: reutilizar PDT copia todos los campos de la meta                  | commit 8ef8375                                                                                          | ✅     |

### Seguridad

| #   | Mejora                                                                                         | Evidencia                                                                        | Estado |
| --- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| S1  | Autenticación OIDC (Keycloak, Code + PKCE) y verificación RS256 en backend                     | commit acf93e0; `VerificadorTokenKeycloak`; `core/dependencias.py`               | ✅     |
| S2  | Autorización por rol (`exigir_roles`), 403 `PermisoInsuficiente`                               | `core/dependencias.py`; `tests/test_autorizacion_rutas.py`                       | ✅     |
| S3  | Endpoint `opciones-filtro` ya no es público                                                    | commits 8723495, 03c4fdb                                                         | ✅     |
| S4  | Realm de Keycloak provisionado automáticamente                                                 | `keycloak/import/govsync-realm.json`; commit 5dfdeb7                             | ✅     |
| S5  | Límite de subida a nivel ASGI y CORS como middleware más externo                               | `main.py` (`RequestBodyLimitMiddleware`, `CORSMiddleware`); `tests/test_main.py` | ✅     |
| S6  | Hallazgos de seguridad de SonarCloud tratados (17 corregidos, 4 falsos positivos documentados) | `docs/SEGURIDAD.md` § Hallazgos de SonarCloud; PR #126                           | ✅     |

## 3.3 Detalle técnico de cada mejora

### 3.3.1 Protección de la rama `develop` (⚠️ evidencia parcial)

**Lo que sí se puede demostrar desde el repositorio**

- Todo cambio entra a `develop` por Pull Request: el historial reciente contiene exclusivamente
  merges de PR (#128 … #161) y la convención de `CONTRIBUTING.md` prohíbe commits directos.
- `.github/CODEOWNERS` exige revisión por ruta (dominio/casos de uso → `@CrisCamUO`;
  persistencia, `shared/` y workflows → `@JEMG2004`; frontend → ambos).
- `ci.yml` se ejecuta en `pull_request` hacia `main` y `develop` (y en `push`), incluidos los
  eventos `edited` (corrección tras el PR #154, donde un PR re-apuntado a `develop` quedó
  mergeable sin que CI hubiera corrido).
- Los PR de Dependabot apuntan a `develop` (`target-branch: "develop"`).

**Lo que NO se puede verificar desde el código**

Las _branch protection rules_ / _rulesets_ se guardan en la configuración de GitHub
(Settings → Branches), no en el repositorio, y la CLI `gh` no está disponible en el entorno
de análisis. Antes de entregar el informe hay que adjuntar una captura de la regla o el
resultado de `gh api repos/JuanDv1/govsync/branches/develop/protection`.

**Configuración recomendada para dejarla alineada con el flujo real** (aplicar y capturar):

| Ajuste                                 | Valor                                                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Require a pull request before merging  | Activado                                                                                                                                                       |
| Required approvals                     | 1 (con _Require review from Code Owners_)                                                                                                                      |
| Dismiss stale approvals on new commits | Activado                                                                                                                                                       |
| Require status checks to pass          | `Lint & Format`, `Tests`, `Build`, `Backend — lint, formato y pruebas`, `Backend — migraciones contra PostgreSQL 16`, `Validate commit messages`, `SonarCloud` |
| Require branches to be up to date      | Activado                                                                                                                                                       |
| Quality Gate de SonarCloud             | Exigido como check requerido (el job `sonarcloud` ya publica el resultado)                                                                                     |
| Restrict force-push / deletions        | Activado                                                                                                                                                       |

> Nota: el job `sonarcloud` queda _skipped_ si `backend-calidad` falla (diseño intencional,
> comentado en `ci.yml`); con `Backend — lint, formato y pruebas` también requerido el bloqueo
> se mantiene.

### 3.3.2 Pruebas automatizadas del frontend (⚠️ hecho en rama, no integrado)

**Estado en `develop`:**

- `frontend/package.json` no define `test` ni dependencias de Vitest/Jest/Testing Library.
- `npm test` en la raíz (`npm run test --workspaces --if-present`) no ejecuta nada, por lo que
  el job **Tests** de `ci.yml` pasa en verde sin probar el frontend.
- `sonar-project.properties` mantiene `sonar.coverage.exclusions=frontend/**` con el comentario
  «aún no tiene pruebas automatizadas».

**Trabajo existente en la rama `test/frontend-vitest`** (autor: CrisCamUO, 2026-09-27):

- `15ba856 test(frontend): agrega Vitest y pruebas de humo` — `vite.config.js` con bloque de test,
  `src/setupTests.js` y cuatro suites: `App.test.jsx`, `api/cliente.test.js`,
  `components/Estados.test.jsx`, `lib/formato.test.js`.
- `84327a1 ci(despliegue): sube cobertura del frontend a CI y SonarCloud` — el job `test`
  ejecuta `vitest --coverage`, publica `frontend/coverage/lcov.info` como artefacto y el job
  `sonarcloud` lo descarga para `sonar.javascript.lcov.reportPaths`.

**Para cerrar el compromiso:** abrir PR de `test/frontend-vitest` hacia `develop`, rebasarla
(desde entonces se añadieron `lib/filtros.js`, `FiltrosMatriz.jsx`, `auth/`), ampliar las
pruebas a `lib/filtros.js` y `auth/`, retirar `frontend/**` de `sonar.coverage.exclusions` y
registrar la cobertura real obtenida. Hasta que eso ocurra, no debe declararse el 0 % como
superado.

### 3.3.3 Refactorización de deuda técnica / code smells (⚠️ parcial)

**Corregido (con evidencia):**

| Hallazgo                                                    | Corrección                                                                    | Evidencia                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| `python:S1764` (`x != x`) y `pythonbugs:S2583`              | `math.isnan` en `_comun.py` y `shared/codigos.py`, con prueba de NaN añadida  | 8590ccf; `docs/SEGURIDAD.md`    |
| `python:S8414` orden de middlewares                         | CORS pasa a ser el más externo; prueba del 413 con cabeceras CORS             | `main.py`; `tests/test_main.py` |
| `javascript:S2137` componente `Error`                       | Renombrado a `EstadoError`                                                    | 8ed43a7                         |
| `githubactions:S6505` / `S8543`                             | `npm ci --ignore-scripts`; `./node_modules/.bin/commitlint` en lugar de `npx` | 6d72505                         |
| Secreto de BD en código / `COPY . .` en Dockerfile          | `database_url` obligatoria; copia explícita + `.dockerignore`                 | PR #126                         |
| Complejidad cognitiva en el selector y filtros de la matriz | Extracción de hook y componentes                                              | 4b943e0, 87bdc19, 9a5c977       |
| Hallazgos de Sonar en login (PR de Keycloak) y HU-05        | Correcciones puntuales                                                        | e32750e, ebbdcdd, 744a675       |

**No resuelto:**

- Los **28 casos de `pytest.raises` impredecibles**: al 2026-10-20 hay 73 `pytest.raises` en
  `backend/tests` y **ninguno** usa `match=`. Ejemplo: `tests/test_casos_uso_cortes.py:151`
  (`pytest.raises(ReglaDeNegocioViolada)` sin verificar el mensaje). Corrección propuesta:
  añadir `match=` con el fragmento del mensaje de dominio, o `as exc` + aserción sobre
  `exc.value`.
- Los **literales duplicados**: no hay commit que los trate de forma sistemática.
- **No hay una cifra posterior a los 65 smells** en el repositorio (las métricas viven en
  SonarCloud). Para el informe, tomar la cifra actual del dashboard `JuanDv1_govsync`; no se
  la inventa aquí.

### 3.3.4 Resiliencia del pipeline (✅ mejorado; staging ❌)

`ci.yml` pasó de «build, pruebas y migraciones» (commit 2b8e348, 2026-09-10) a:

```text
PR / push ─► Lint&Format · Tests · Build · backend-calidad(ruff+pytest≥70%)
             backend-migraciones(upgrade→downgrade→upgrade) · backend-keycloak · commitlint
             sonarcloud (needs: backend-calidad)
push a main ─► migrate-render (needs: backend-calidad + backend-migraciones)
               ├─ alembic upgrade head  → RENDER_DATABASE_URL
               └─ POST RENDER_DEPLOY_HOOK (3 reintentos)   [Auto-Deploy de Render = OFF]
```

- Orden garantizado _pruebas → migración → despliegue_: el código nuevo nunca arranca sobre un
  esquema viejo (`docs/DESPLIEGUE.md`).
- `concurrency: produccion-render` con `cancel-in-progress: false`: nunca dos migraciones
  simultáneas ni una migración cortada a la mitad.
- Fallo del hook tras migrar → job en rojo y _Plan B_ documentado (Manual Deploy).
- Limitación declarada: `migrate-render` **no hace respaldo previo** de la BD de producción.
- **Staging:** no existe. La validación previa a producción es Postgres efímero en CI y
  preview deploy por PR en Vercel (solo frontend). Crear un servicio y una BD de staging en
  Render alimentados desde `develop` queda como trabajo para el Sprint 3.

### 3.3.5 Seguridad: autenticación y autorización JWT

- **Verificación:** `VerificadorTokenKeycloak` (`identidad/persistence/keycloak.py`) usa
  `PyJWKClient` (JWKS del realm con caché), valida firma **RS256**, `issuer` y `audience`
  (la audiencia es obligatoria por diseño, documentado en el módulo). El backend no firma
  tokens ni guarda contraseñas.
- **Dependencias FastAPI:** `UsuarioActualDep` (autenticación) y `exigir_roles(*roles)`
  (autorización → 403 `PermisoInsuficiente`). Roles: `administrador`, `gestor`, `visitante`.
- **Cobertura de pruebas:** `test_keycloak.py`, `test_dependencias_identidad.py`,
  `test_identidad.py`, `test_autorizacion_rutas.py`.
- **Correcciones de revisión:** endpoint `GET opciones-filtro` ahora exige autenticación
  (8723495); CA05/CA06 de HU01 cerrados tras la revisión del PR (dd1883f).
- **Frontend:** `RutaProtegida`, `useAutenticacion().puedeEscribir` oculta acciones de
  escritura; la autoridad real es el backend.
- **Límite conocido:** el CI solo tiene un smoke test de Keycloak; no hay prueba de integración
  con un token real (`CLAUDE.md`, sección Autenticación).

### 3.3.6 Rendimiento y seguridad en el procesamiento de archivos Excel

- **Corte por tamaño en streaming:** `RequestBodyLimitMiddleware` (25 MB) envuelve `receive()`
  de ASGI, cuenta bytes reales y corta con 413 aunque `Content-Length` falte o mienta; el
  router filtra antes por `Content-Length` (422 estructurado). Ver `main.py` y
  `cortes/api/router.py::_extraer_archivo_subido`.
- **Validación de envoltura sin parsear** (`cortes/application/validacion_archivos.py`): solo
  `zipfile` + `io`; extensión `.xlsx`, firma ZIP, rechazo de `.xlsm` y `xl/vbaProject.bin`
  aunque esté renombrado, sanitización del nombre. Archivo inválido ⇒ rechazo total.
- **Lectura eficiente:** `ingesta/persistence/lectores/_comun.py` abre con
  `openpyxl.load_workbook(..., read_only=True, data_only=True)` y recorre con `iter_rows`
  (sin fórmulas ni estilos). La detección de encabezados limita la búsqueda a las primeras
  `max_filas=8`.
- **Matiz honesto:** el archivo aceptado (≤ 25 MB) queda en memoria como `BytesIO`; la
  mejora está en el rechazo temprano y en la lectura fila a fila, no en procesar sin cargar el
  archivo.
- **Exportación:** `plan_accion/persistence/exportacion_excel.py` genera el Excel del Plan de
  Acción y de la comparación entre cortes, con pruebas (`test_exportacion_excel_plan_accion.py`).

### 3.3.7 Filtros y comparación del Plan de Acción

- Endpoints en `plan_accion/api/router.py`: `GET /actual` (con filtros), `GET /exportar`,
  `GET` de cortes disponibles, comparación entre dos cortes y exportación de la comparación.
- Filtros agregados en backend (`3022702`) con corrección del filtro exacto de Indicador
  (`e6a4884`, CA09, decisión D27) y filtros repetibles/opciones en el cliente API del
  frontend (`24b9893`), con panel, etiquetas y autocompletado (`8f76c08`, `60b4985`).
- Validación de fuentes completas (`_verificar_fuentes_completas`) antes de consolidar y
  correcciones de la revisión del PR #154 (`ecf074f`).
- Pruebas: `test_consultas_plan_accion.py`, `test_router_plan_accion.py`,
  `test_comparacion_plan_accion.py`, `test_dominio_plan_accion.py`.

## 3.4 Compromisos abiertos para el Sprint 3

| Prioridad | Acción                                                                                                     | Dueño sugerido |
| --------- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| Alta      | Integrar `test/frontend-vitest` a `develop`, ampliar pruebas y quitar `frontend/**` de exclusiones Sonar   | Frontend + CI  |
| Alta      | Adjuntar evidencia (captura / `gh api`) de la protección de `develop` y exigir checks + Quality Gate       | Admin del repo |
| Media     | Añadir `match=` a los `pytest.raises` y eliminar literales duplicados; registrar el conteo final de smells | Backend        |
| Media     | Ambiente de staging (Render + BD propia) desplegado desde `develop`                                        | DevOps         |
| Media     | Respaldo automático de la BD previo a `alembic upgrade head` en `migrate-render`                           | DevOps         |
| Baja      | Prueba de integración con token real de Keycloak                                                           | Backend        |
