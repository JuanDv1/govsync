# Seguridad — checklist OWASP y específico de GovSync

Checklist a completar a medida que se implementa cada tarjeta con superficie
de seguridad. No marcar "Verificado" sin una prueba o evidencia concreta —
ocultar una opción en el frontend no cuenta como verificación (regla del
proyecto).

## Tabla 4 de la rúbrica — OWASP Top 10

| Verificación                | Estado     | Evidencia / tarjeta responsable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL Injection               | Verificado | Auditado 2026-09-18: todo el acceso a datos pasa por el ORM de SQLAlchemy (`repositorios.py`, `consultas.py`). Único uso de `sa.text()` en el repo es una cadena estática en `models.py` (`postgresql_where=sa.text("estado = 'BORRADOR'")`, cláusula de un índice parcial), sin dato de usuario interpolado. Ningún `execute()`/`.format()`/f-string con SQL crudo en el backend. **Reverificado 2026-09-23 (D22):** el nuevo filtro `busqueda` de la matriz de relación (entrada de usuario libre, comparada con `ILIKE`) se construye con el operador parametrizado de SQLAlchemy (`.ilike(f"%{valor}%")` como parámetro bind, no como SQL concatenado) — prueba de esto en `docs/archivo/sprint-1/evidencia_sql_injection.txt`, incluyendo un caso con payload de inyección literal |
| XSS (Cross-Site Scripting)  | Verificado | Auditado 2026-09-18: React escapa por defecto; `grep -rn "dangerouslySetInnerHTML" frontend/src/` no encuentra ningún uso en todo el frontend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CSRF                        | N/A        | La API sigue sin usar cookies de sesión: desde `[HU-E01-01]` (D23) el token viaja en el header `Authorization: Bearer`, que un sitio de terceros no puede fijar automáticamente en una petición cross-site (a diferencia de una cookie) — CSRF clásico no aplica. Reemplaza la justificación anterior ("no hay autenticación en Sprint 1"), obsoleta desde que se implementó Keycloak                                                                                                                                                                                                                                                                                                                                                                                                   |
| Autenticación               | Verificado | Keycloak (OIDC, Authorization Code + PKCE) — `[HU-E01-01]`, D23/D24 en `docs/DECISIONES.md`. El backend nunca firma ni almacena contraseñas: `VerificadorTokenKeycloak` (`identidad/persistence/keycloak.py`) valida cada token contra el JWKS real del realm (RS256), con `issuer`/`audience` exigidos. Probado con `pytest` (`test_keycloak.py`, llaves RSA en memoria) y manualmente de punta a punta contra un Keycloak real (2026-10-09/10): login por navegador para `administrador`/`gestor` y `visitante`; sin token → 401 `credenciales_invalidas`                                                                                                                                                                                                                             |
| Autorización                | Verificado | `exigir_roles()` (`core/dependencias.py`) protege los endpoints de escritura de `cortes`/`trazabilidad` (D24): solo `administrador`/`gestor` pasan, `visitante` recibe 403 `permiso_insuficiente` con `roles_requeridos`. Probado con `pytest` (`test_autorizacion_rutas.py`) y confirmado manualmente contra Keycloak real: token de `visitante` → 403 en `POST /cortes`, 200 en `GET /cortes`                                                                                                                                                                                                                                                                                                                                                                                         |
| Datos sensibles encriptados | Verificado | Los datos son información pública municipal (Ley 1712 de 2014, transparencia y acceso a la información pública). En tránsito viajan por HTTPS (Vercel para el frontend, Render para la API). Los secretos viven en GitHub Secrets y en las variables de entorno de Render, nunca en el repositorio. La base de datos de Render está cifrada en reposo por el proveedor                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Específico de GovSync — validación de archivos cargados (`[SEC-03]`)

Esta sección sigue siendo sobre la carga de archivos Excel, no sobre login
(ese ya tiene su propia fila arriba, "Autenticación"/"Autorización" — delegado
por completo a Keycloak, el backend no implementa su propio flujo de acceso).
Checklist de `[SEC-03]`:

- [x] Extensión declarada vs. tipo MIME real del contenido (no confiar en la
      extensión del nombre de archivo) — `validacion_archivos.py::_verificar_extension` + `_verificar_estructura_y_macros` valida la firma real de ZIP (`PK\x03\x04`),
      no solo el sufijo del nombre
- [x] Tamaño máximo verificado **antes** de leer el archivo completo en
      memoria (corregido 2026-09-20 — la nota anterior de esta fila decía
      que "el corte por streaming vive en el router" pero eso nunca se
      había implementado: `cargar_archivo` hacía
      `contenido = await archivo.read()` completo antes de que
      `_verificar_tamano` revisara nada). Ahora es de dos capas: (1) `cortes/api/router.py::cargar_archivo` — filtro por
      `Content-Length`, rechaza sin leer nada si el cliente declara el
      tamaño y ya excede `max_upload_bytes`. Cubre el caso común
      (cliente honesto); responde 422 estructurado
      (`ArchivoInvalido`, `detalles.motivo == "tamano_excedido"`). (2) `main.py::crear_app` (`RequestBodyLimitMiddleware`, de
      `starlette.middleware.body_limit`) — respaldo autoritativo a
      nivel ASGI: envuelve `receive()` y corta apenas se exceden los
      bytes reales, sin importar si `Content-Length` falta (`chunked transfer-encoding`)
      o miente. **No** pasa por `ArchivoInvalido`:
      responde `413 Content Too Large` en texto plano — excepción
      deliberada al contrato 422 de SEC-03, documentada aquí y en el
      docstring de `cargar_archivo`, porque reimplementar el parseo
      multipart a mano para preservar el 422 en ese único caso
      adversarial no se justificó frente al costo.
      `_verificar_tamano` (`validacion_archivos.py`) sigue como defensa
      en profundidad real (esta vez sí, ambas capas anteriores usan el
      mismo `max_upload_bytes`, `core/config.py`) para cualquier archivo
      que sí llegue completo a la capa de aplicación.
      NOTA: se probó primero pasar `max_part_size` a `request.form()`
      esperando que cortara archivos grandes durante el parseo — no
      funciona: en la versión instalada de Starlette (1.6.0),
      `MultiPartParser.on_part_data` solo aplica ese límite a campos de
      formulario sin `filename`, nunca a la parte que es un archivo
      (verificado leyendo `formparsers.py`, no asumido). Por eso el
      respaldo real es el middleware, no una opción del parser
- [x] Sanitización del nombre de archivo (rechazar path traversal, ej.
      `../../etc/passwd`) — `validacion_archivos.py::sanitizar_nombre`
- [x] Rechazo explícito de libros con macros (`.xlsm`) — `_verificar_estructura_y_macros`
      inspecciona el ZIP en busca de `xl/vbaProject.bin` y la marca `macroEnabled`;
      un `.xlsm` renombrado a `.xlsx` no lo engaña
- [x] Verificación de que las hojas obligatorias existen antes de procesar
      (no leer estructuras parciales) — `_verificar_estructura_y_macros` exige
      al menos una hoja real (`xl/worksheets/*.xml`); el nombre concreto de
      cada pestaña lo resuelve el lector de cada fuente (HU-02/03/04)
- [x] Los mensajes de error no exponen rutas internas del servidor ni trazas
      completas de excepción al cliente — ver sección siguiente

Evidencia: `test_validacion_archivos.py` (16 pruebas), 170 passed en local
(2026-09-18). Consumido por `[HU-02][BE-04]`, `[HU-03][BE-06]`, `[HU-04][BE-04]`
(los tres casos de uso `cargar_archivo`, todavía `NotImplementedError`).

## Manejo de secretos

- [x] Ningún archivo `.env` real llegó al repositorio (`[SEC-02]`) — verificado
      2026-09-18 con `git ls-files | grep -i "\.env"`: solo `backend/.env.example`
      y `frontend/.env.example` están trackeados; `.gitignore` cubre `.env`,
      `.env.local` y `backend/.env`
- [x] Variables de entorno documentadas en `.env.example` sin valores reales —
      `KEYCLOAK_ISSUER=http://localhost:8080/realms/govsync` es explícitamente
      un placeholder de desarrollo; `config.py` tiene un `field_validator` que
      **lanza excepción** si `environment=="production"` y el emisor sigue
      conteniendo `localhost`
- [ ] `SONAR_TOKEN` y credenciales de despliegue viven en GitHub Secrets, no
      en el código ni en `docker-compose.yml` — **no verificable desde el
      repositorio local** (son ajustes de GitHub, no de código). `[DEV-06]` ya
      está implementado: SonarCloud corre en cada push/PR (job `sonarcloud` de
      `.github/workflows/ci.yml`) junto con CodeQL (`.github/workflows/codeql.yml`)
- [ ] Los PRs que abre Dependabot **no** leen los secrets de GitHub Actions:
      usan el almacén de secrets de **Dependabot** (Settings → Secrets and
      variables → Dependabot). Para que el job `sonarcloud` funcione en esos
      PRs, `SONAR_TOKEN` debe estar registrado también ahí

## Cadena de suministro de dependencias

- [x] Dependencias del backend fijadas por versión **y por hash** —
      `backend/requirements.txt` y `backend/requirements-dev.txt` se generan con
      `uv pip compile --universal --generate-hashes` a partir de
      `requirements.in` / `requirements-dev.in` (procedimiento en
      `CONTRIBUTING.md`). La CI (`backend-calidad`, `backend-migraciones`,
      `migrate-render`) y el `Dockerfile` instalan con
      `pip install --require-hashes --only-binary ":all:"`: pip rechaza cualquier
      archivo cuyo hash no coincida y nunca compila un paquete desde el código
      fuente (no ejecuta `setup.py` de terceros). Resuelve el hallazgo de
      SonarCloud "Using dependencies without locking resolved versions"; es
      crítico en `migrate-render`, el único job con acceso a la BD de producción
- [x] **Falso positivo documentado:** SonarCloud marca `POSTGRES_PASSWORD: govsync`
      en `.github/workflows/ci.yml` como credencial en el código. Es la
      contraseña de un contenedor Postgres efímero del job `backend-migraciones`:
      solo existe durante la ejecución, no es accesible fuera del runner y no
      contiene datos reales. La credencial de producción vive en el secret
      `RENDER_DATABASE_URL`, nunca en el repositorio. Esa contraseña **no debe
      reutilizarse en ningún entorno real**

## Exposición de errores internos

- [x] Las excepciones de dominio (`app/shared/errors.py`) llegan al cliente
      como mensajes de negocio (ej. "falta el archivo de ejecución"), nunca
      como traceback de Python ni detalle de SQLAlchemy — `app/core/errores.py`
      tiene un manejador genérico (`_manejar_error_no_previsto`) que registra
      la excepción completa solo en el log del servidor y responde al cliente
      con un mensaje fijo ("Ocurrió un error inesperado...", HTTP 500), sin
      exponer la traza ni el mensaje interno

## CORS

- [x] CORS restringido a orígenes explícitos, nunca `*` — `main.py` usa
      `CORSMiddleware(allow_origins=settings.cors_origins_list)`, configurable
      por `CORS_ORIGINS` (por defecto solo `http://localhost:5173` en desarrollo)
- [ ] Confirmar el dominio real de producción cuando `[DEV-07]` despliegue
      (hoy solo se verificó el valor de desarrollo local)

## Hallazgos de SonarCloud — Sprint 1

21 hallazgos de Seguridad y Confiabilidad: 16 issues (consultables en la API
pública de SonarCloud) y 5 Security Hotspots. 17 se corrigen en el PR
`fix/seguridad/issues-sonarcloud`; 4 son falsos positivos.

| Issue                                                                      | Archivo                                                      | Severidad               | Tratamiento          | Justificación                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secrets:S6698` Contraseña de PostgreSQL en el código                      | `backend/app/core/config.py`                                 | Blocker (Seguridad)     | Corregido en este PR | `database_url` pasa a ser obligatoria, sin valor por defecto. En local viene de `.env` (`.env.example`), en pruebas de `tests/conftest.py` y en Render de sus variables de entorno    |
| Hotspot: `COPY . .` puede copiar datos sensibles                           | `backend/Dockerfile`                                         | High (Hotspot)          | Corregido en este PR | Copia explícita de `app/`, `alembic/` y `alembic.ini`; además `backend/.dockerignore` excluye `.env`, entornos virtuales, pruebas y scripts                                           |
| `githubactions:S6505` `npm ci` sin `--ignore-scripts` (Lint & Format)      | `.github/workflows/ci.yml`                                   | Medium (Seguridad)      | Corregido en este PR | `npm ci --ignore-scripts`: un paquete comprometido no ejecuta scripts de instalación                                                                                                  |
| `githubactions:S6505` `npm ci` sin `--ignore-scripts` (Tests)              | `.github/workflows/ci.yml`                                   | Medium (Seguridad)      | Corregido en este PR | Ídem                                                                                                                                                                                  |
| `githubactions:S6505` `npm ci` sin `--ignore-scripts` (Build)              | `.github/workflows/ci.yml`                                   | Medium (Seguridad)      | Corregido en este PR | Ídem; verificado que Vite/esbuild compila sin scripts de instalación                                                                                                                  |
| `githubactions:S6505` `npm ci` sin `--ignore-scripts` (commitlint)         | `.github/workflows/ci.yml`                                   | Medium (Seguridad)      | Corregido en este PR | Ídem                                                                                                                                                                                  |
| `githubactions:S6505` `npx` puede instalar paquetes y ejecutar sus scripts | `.github/workflows/ci.yml`                                   | Medium (Seguridad)      | Corregido en este PR | Se usa `./node_modules/.bin/commitlint`, ya instalado desde `package-lock.json`                                                                                                       |
| `githubactions:S8543` `npx` sin versión exacta                             | `.github/workflows/ci.yml`                                   | Medium (Seguridad)      | Corregido en este PR | Ídem: la versión queda fijada por `package-lock.json`                                                                                                                                 |
| `python:S8414` `CORSMiddleware` no es el último middleware                 | `backend/app/main.py`                                        | Blocker (Confiabilidad) | Corregido en este PR | CORS pasa a ser el más externo: el 413 de `RequestBodyLimitMiddleware` ahora lleva cabeceras CORS. Prueba: `tests/test_main.py::test_413_por_cuerpo_excedido_conserva_cabeceras_cors` |
| `python:S1764` `x != x` (`normalizar_encabezado`)                          | `backend/app/modules/ingesta/persistence/lectores/_comun.py` | Medium (Confiabilidad)  | Corregido en este PR | `math.isnan(x)` expresa la intención (detectar NaN) sin depender de una comparación que parece un error                                                                               |
| `python:S1764` `x != x` (`texto`)                                          | `backend/app/modules/ingesta/persistence/lectores/_comun.py` | Medium (Confiabilidad)  | Corregido en este PR | Ídem                                                                                                                                                                                  |
| `pythonbugs:S2583` condición "siempre falsa" (`texto`)                     | `backend/app/modules/ingesta/persistence/lectores/_comun.py` | Medium (Confiabilidad)  | Corregido en este PR | Ídem (la condición no era siempre falsa: es verdadera con NaN; `math.isnan` elimina la ambigüedad)                                                                                    |
| `python:S1764` `x != x` (`numero`)                                         | `backend/app/modules/ingesta/persistence/lectores/_comun.py` | Medium (Confiabilidad)  | Corregido en este PR | Ídem                                                                                                                                                                                  |
| `python:S1764` `x != x` (`fecha`)                                          | `backend/app/modules/ingesta/persistence/lectores/_comun.py` | Medium (Confiabilidad)  | Corregido en este PR | Ídem; se agregó la prueba de NaN que faltaba (`test_lectores_comun.py::TestFecha`)                                                                                                    |
| `python:S1764` `x != x` (`_a_texto`)                                       | `backend/app/shared/codigos.py`                              | Medium (Confiabilidad)  | Corregido en este PR | Ídem (`math` es stdlib, permitido en `shared/`)                                                                                                                                       |
| `pythonbugs:S2583` condición "siempre falsa" (`_a_texto`)                  | `backend/app/shared/codigos.py`                              | Medium (Confiabilidad)  | Corregido en este PR | Ídem                                                                                                                                                                                  |
| `javascript:S2137` componente llamado `Error` oculta el `Error` nativo     | `frontend/src/components/Estados.jsx`                        | Medium (Confiabilidad)  | Corregido en este PR | Renombrado a `EstadoError`; se actualizaron todos los imports                                                                                                                         |
| Hotspot: credencial en `DATABASE_URL` del job `backend-migraciones`        | `.github/workflows/ci.yml`                                   | Hotspot                 | Falso positivo       | Postgres efímero del CI: existe solo durante el job, no es accesible fuera del runner y no tiene datos reales (ver §Cadena de suministro)                                             |
| Hotspot: contraseña de Postgres                                            | `docker-compose.yml`                                         | Hotspot                 | Falso positivo       | Base de datos local de desarrollo; esa contraseña no se usa en ningún entorno real                                                                                                    |
| Hotspot: dirección IP en el código (`"2.3.2.1"`)                           | `backend/scripts/cargar_datos_ejemplo.py`                    | Hotspot                 | Falso positivo       | No es una IP: es un código de rubro presupuestal (formato del CCPET); coincidencia de patrón                                                                                          |
| Hotspot: dirección IP en el código (`"2.3.2.2"`)                           | `backend/scripts/cargar_datos_ejemplo.py`                    | Hotspot                 | Falso positivo       | Ídem                                                                                                                                                                                  |

---

**Cómo se llena:** cada tarjeta que toque una de estas filas debe, al
cerrarse, actualizar el Estado y dejar el enlace al PR o a la prueba que lo
demuestra. Antes del cierre del Sprint 1, esta tabla debe copiarse (ya
resuelta) a la Tabla 4 del documento de entrega, tal como pide
`PlantillaSprint1.md` §4.3.
