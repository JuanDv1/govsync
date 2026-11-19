# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GovSync — consolidation and cross-validation of planning, budget execution, and investment
project data for category-6 municipalities in Colombia. Pilot: Santa Rosa (Cauca). Monorepo:
FastAPI backend (`backend/`) + React frontend (`frontend/`) + PostgreSQL. Domain and docs are in
Spanish; keep new code, commits, and identifiers in Spanish to match the existing codebase.

## Commands

Run from repo root unless noted.

```bash
npm install          # also installs husky (commit-msg/pre-commit hooks) and lint-staged
npm run dev           # frontend dev server (Vite)
npm run build         # frontend build
npm run lint          # eslint on frontend/src
npm run format        # prettier --write .
npm run format:check
docker compose up -d  # Postgres 16 + Keycloak (dev mode) — backend and frontend run locally for hot reload
```

Backend (from `backend/`, with a Python 3.12+ venv active):

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest                                    # full suite; runs with coverage (see pyproject.toml)
pytest tests/test_arquitectura.py         # architecture boundary checks — run after touching any module
pytest tests/test_codigos.py -k acepta    # single test by node id or -k expression
ruff check .                              # lint (select: E,F,W,I,N,UP,B,C4,SIM,RUF)
ruff check . --fix
ruff format .
alembic revision --autogenerate -m "mensaje"
alembic upgrade head
```

### Adding or updating a backend dependency

`requirements.txt` and `requirements-dev.txt` are generated with hashes (supply-chain control,
see `docs/SEGURIDAD.md`); CI, the Dockerfile and Render install with
`--require-hashes --only-binary ":all:"`. Only the `.in` files are edited by hand (direct
dependencies, pinned with `==`): `requirements.in` for production and `requirements-dev.in` for
dev tooling. Then, from `backend/` (`pip install uv` if missing):

```bash
uv pip compile requirements.in --universal --python-version 3.12 --generate-hashes -o requirements.txt
uv pip compile requirements-dev.in -c requirements.txt --universal --python-version 3.12 --generate-hashes -o requirements-dev.txt
pip install -r requirements.txt -r requirements-dev.txt
```

**Never edit `requirements*.txt` by hand or use `pip freeze`**: it drops the hashes and the
platform markers (`--universal` produces a single file valid for both Windows and Linux).

Commits are validated by commitlint (Conventional Commits, see below) via a husky `commit-msg`
hook — `npm install` at the root activates it.

### After pulling `develop`

Run `npm ci` (root) and `pip install -r requirements.txt -r requirements-dev.txt` (from `backend/`),
then copy any new variables from `backend/.env.example` and `frontend/.env.example` into your own
`.env` files — in particular the Keycloak ones (`VITE_KEYCLOAK_*` in the frontend, `KEYCLOAK_ISSUER`
and `KEYCLOAK_AUDIENCE` in the backend). If the `cryptography` package is missing from the backend
venv, PyJWT cannot verify RS256 and a valid token surfaces as `401 credenciales_invalidas`; reinstall
and restart uvicorn (the verifier is cached).

## Architecture

Backend is a **modular monolith with 5 layers**, and the dependency direction is enforced by an
executable test, not just convention: [backend/tests/test_arquitectura.py](backend/tests/test_arquitectura.py).
Before changing backend code, know that this test will fail the build if:

- `domain/` or `shared/` import FastAPI, SQLAlchemy, Alembic, pandas, numpy, openpyxl, psycopg,
  passlib, jwt, or Pydantic — domain is pure Python.
- `application/` imports FastAPI/Starlette — a use case must be runnable from a plain script or test.
- a router under `api/` imports sqlalchemy/pandas/openpyxl directly — routers translate HTTP, they
  don't query data.
- pandas/openpyxl are used anywhere outside a `persistence/` package.
- a module reaches into another module's `persistence` layer (only `cortes` importing from
  `ingesta` is allowed, for the ETL orchestration in `cortes/application/casos_uso.py`).

Layout per module (`app/modules/<modulo>/`): `api/` (FastAPI routers) → `application/` (use
cases, orchestration) → `domain/` (entities, value objects, ports/interfaces, business
exceptions) ← `persistence/` (SQLAlchemy models, repositories, Excel readers). Dependencies point
toward the domain; persistence implements the domain's ports.

Modules: `cortes` (the tracking "corte" — the aggregate everything else hangs off), `ingesta`
(Excel readers/parsers for the three source files), `trazabilidad` (cross-reference queries/matrix
between indicators, budget execution, and BPIN projects), `identidad` (Keycloak token
verification and the `Rol`/`Usuario` domain types — see Architecture above), `plan_accion` (E04
Plan de Acción: consolidated view, filters, Excel export and comparison between two cortes, served
under `/plan-accion`; `api/`, `domain/` and `persistence/` only — no `application/` layer and no
frontend yet), `alertas` (E04-HU05: unrelated-records report between the sources, served under
`/registros-no-relacionados`; `api/`, `domain/` and `persistence/` only, read-only, no new tables).
`avance_fisico/` exists as an empty module directory (`.gitkeep` only, no code) — a placeholder for
a future épica, not a stub to fill in without a card. Shared kernel: `app/shared/codigos.py`
(the `CodigoIndicadorProducto` value object — the 9-digit key that joins all four data sources;
**always store as text, never as int**, since real codes like `040110500` start with a leading
zero) and `app/shared/errors.py` (`GovSyncError` hierarchy — domain exceptions in Spanish, no
`Error` suffix required since they read as domain phrases, e.g. `ArchivoInvalido`,
`ReglaDeNegocioViolada`). `app/core/` holds cross-cutting config (`config.py`, env-var driven,
no usable prod defaults for secrets), DB session (`database.py`), FastAPI dependencies
(`dependencias.py`), and the single exception-to-HTTP translation point (`errores.py`).

Authentication/authorization (`[HU-E01-01]`, see `docs/DECISIONES.md` D23/D24 — supersedes D2)
is implemented via **Keycloak** (OIDC, Authorization Code + PKCE), not a self-issued JWT: the
backend only validates tokens against the realm's JWKS, never signs or stores a password. Module
`identidad` (`app/modules/identidad/`) holds `Rol`/`Usuario`/`VerificadorToken` (domain) and
`VerificadorTokenKeycloak` (persistence, PyJWT + `cryptography`, RS256). `core/dependencias.py`
exposes `UsuarioActualDep` (authentication only) and `exigir_roles(*roles)` (authorization —
raises `PermisoInsuficiente`, mapped to 403). Three realm roles: `administrador` (primary
operational role — uploads/corrects, broad access), `gestor` (Supervisor, whose
work is Épica 3 — out of Sprint 3; since D37 it has **no enabled modules**: 403 on every route,
and the frontend shows `PantallaSinAcceso` instead of the layout), `visitante` (read-only).
D24/D37 map which endpoints need which: reads on `cortes`/`trazabilidad` require
`administrador`/`visitante` (`LecturaDep`), writes on `cortes` require `administrador` only. Login theme at `keycloak/themes/govsync/` no longer "imitates" `Login.jsx`: it shares its
tokens and classes — `.ftl` templates use the same Tailwind classes as `Login.jsx`/`Boton.jsx`/
`Campo.jsx`, and `resources/css/govsync.css` is GENERATED with the frontend's `tailwind.config.js`
(`npm run build:tema-keycloak`, versioned; rerun it after changing any `.ftl` or a token — a Vitest
test in `frontend/src/tema-keycloak/` fails if a class used by the templates is missing from the CSS). The 3-attempt notice (CA03,
browser-only UX, not a security control) is `resources/js/limite-intentos.js`. The whole realm (clients, roles, theme selection, brute-force/session policy,
3 throwaway test users) is provisioned automatically on first boot from
`keycloak/import/govsync-realm.json` (`--import-realm`, see `docker-compose.yml`) — nothing to
configure by hand; only applies the first time Keycloak starts on a fresh `datos_keycloak` volume,
never overwrites an existing realm. CI only has a smoke test (`backend-keycloak` job: confirms the
container boots on the runner) — no real-token integration test yet.

Public route without credentials (`[E01-HU01]`, D38): `GET /api/v1/publico/plan-accion/actual`
(`plan_accion/api/router_publico.py`) is the ONLY data route that answers without a token — same
corte and same 404/409 as `/plan-accion/actual`, but with its own DTO (never inherited from the
protected one; no `objeto`/`valor`/`valor_pagado` of contracts in `desglose`) and a key whitelist in
`tests/test_router_publico_plan_accion.py`. Everything under `/api/v1/publico` is rate-limited by
`core/limite_peticiones.py` (ASGI middleware, in memory, per process; `PUBLICO_LIMITE_PETICIONES`,
`PUBLICO_VENTANA_SEGUNDOS`, `PUBLICO_PROXIES_CONFIABLES`, `PUBLICO_MAX_CLIENTES`; 429
`limite_peticiones_excedido`). A new public route must be added BY NAME to `RUTAS_PUBLICAS` in
`test_ca05_sin_rol_todas_las_rutas.py` — never exempt a prefix. The Keycloak `visitante` role is
kept (read-only with a session). The frontend side of the card is not done yet.

File upload rules (`[SEC-03]`, enforced in `cortes/application/casos_uso.py`, not in the API
layer): only `.xlsx`, size checked before reading into memory, filename sanitized against path
traversal, macro-enabled `.xlsm` rejected outright, required sheets validated before processing.
An invalid file is rejected **in full** — never partial data.

Frontend (`frontend/src/`): `api/cliente.js` is the shared HTTP client (`[UX-01]`), implemented —
`solicitar()` and the `api` methods (`crearCorte`, `listarCortes`, `obtenerCorte`, `registrarCorte`,
`cargarArchivo`, `matriz`, `opcionesFiltro`, `reemplazarArchivoCorteActual`, `historialCorte`, `corregirCorte`, `descartarCorte`) are
wired to the backend, and it attaches `Authorization: Bearer` from
whatever `establecerProveedorToken()` last set (called once by `ProveedorAutenticacion.jsx`). It
preserves `error.detalles` from failed requests (carries `columnas_faltantes`, `pestanas_faltantes`,
`archivos_faltantes` from the backend so the UI can show actionable messages, not just "failed") —
`ErrorApi` models this shape. `auth/` (`[HU-E01-01]`) holds `keycloak.js` (the single `Keycloak`
instance) and `ProveedorAutenticacion.jsx` (initializes it once — with silent-check-sso via
`public/silent-check-sso.html`, so a page reload doesn't lose an active session — and exposes
`usuario` (with `nombre` and `rol` in words, e.g. "Administradora")/`estaAutenticado`/
`puedeEscribir`/`motivoSinAcceso`/`vistaInicial`/`iniciarSesion`/`cerrarSesion` through
`useAutenticacion()`). `motivoSinAcceso` is the single signal for an account that cannot use any
module: `"sin_rol"` (no GovSync role, CA05) | `"rol_sin_modulos"` (only `gestor`, D37) | `null`;
`RutaProtegida` picks `PantallaSinAcceso` from it (there is no `SinRol.jsx` anymore). The role
rules live in `auth/roles.js` (no React: `motivoSinAcceso`, `vistaInicial`, `etiquetaRol`,
`puedeAbrirRuta`). Initial view per role (CA01, PO 2026-11-16): `/` redirects to `vistaInicial` —
administrador → `/cortes`, visitante → `/plan-accion`, gestor → `PantallaSinAcceso`. After login
(CA07) the original URL is kept only if the role may open it (`puedeAbrirRuta`, decided with the
one-shot `loginReciente` flag from `auth/loginReciente.js`); otherwise it goes to `vistaInicial`;
with an already open session a URL without permission still shows the module's notice
(E04-HU01/CA10). `auth/useInactividad.js` closes the session after 30 min without input (CA04),
sharing the last activity across tabs through `localStorage`. `components/` holds shared UI (`Estados.jsx` for loading/error/empty states,
`EstadoError` implemented; `CargaDeArchivo.jsx`, implemented drag-and-drop upload control shared by
the three source-file uploads, `[UX-02]`; `shared/PantallaSinAcceso.jsx`, the full-screen "no
access" notice (D37, CA05); `Disposicion.jsx`, the sidebar shell with the user's name and role in
its header — hides "Nuevo corte" unless `puedeEscribir`, same role gate `Cortes.jsx` applies to "Crear corte"/"Continuar
carga"; `FiltrosMatriz.jsx` and `shared/SelectorConBusqueda.jsx`, the matrix filter panel with its
active tags and the accessible combobox it uses, `[E02-HU10]`; `shared/ModalConfirmacion.jsx`, a
generic confirmation dialog, `[E02-HU05]`), `pages/` holds route-level screens (`NuevoCorte.jsx`,
`Cortes.jsx`, `MatrizRelacion.jsx`, `EditarArchivosCorteActual.jsx`, `Login.jsx` — redirects to
Keycloak on click, no longer a form) wired into `App.jsx`'s router (`/login`, `/` → initial view, `/cortes`,
`/cortes/nuevo`, `/cortes/:corteId`, `/cortes/:corteId/editar`, `/matriz/:corteId?`); every route
except `/login` and `/publico/plan-accion` (see below) is wrapped in `RutaProtegida`, which redirects to `/login` without an active session.
`lib/` holds pure helpers without React: `rutaDestino.js` (`rutaDestinoSegura`, the only
post-login destinations accepted), `filtros.js` (matrix filter logic, `[E02-HU10]`),
`corteActual.js` (the single "is this the current corte?" criterion) and `formato.js` (amounts and
dates).

Public access without credentials (`[E-01/HU-01]`, PO 2026-11-16, `docs/DECISIONES.md` D38, frontend half; the backend is
`GET /api/v1/publico/plan-accion/actual`, same DTO as `/plan-accion/actual` minus `objeto`, `valor`
and `valor_pagado` of the `desglose` contracts): `Login.jsx` has "Ingresar como visitante" next to
"Ingresar" and `PantallaSinAcceso.jsx` (no-role account and `gestor`) links "Consultar el Plan de
Acción como visitante", both to `/publico/plan-accion`. That route is OUTSIDE `RutaProtegida` and
renders `pages/PlanAccionPublico.jsx` (brand header + "Iniciar sesión" → `/login`, no module menu,
never reads the session), which mounts the SAME `PlanAccion.jsx` with `publico`: it calls
`api.planAccionPublicoActual`, hides "Exportar a Excel" and "Comparar cortes", skips
`cortesDisponibles` (needs a session), drops the "detalle del contrato se agregará" note, and in
errors shows no backend `detalles` (409 → fixed text; 429 → "Demasiadas consultas, intente en un
momento"; any other error → fixed generic text, never the backend's `mensaje`/`codigo`). Filters
stay in the browser. `ProveedorAutenticacion` still wraps this route (Keycloak `check-sso` runs
there; the page does not wait for it) — not yet tried in a browser with Keycloak down or with an
open session. `api/cliente.js` `solicitar(ruta, { publico: true })` is
the only way to skip the token: it sends no `Authorization` even with a session and uses
`credentials: "omit"`; any new public endpoint must opt in the same way, and authenticated ones
never do. An account with a role keeps using `/plan-accion` (with login).

## Where things live

- Card status, priority, owner, estimate: **Trello only** — no Markdown file replicates it. Board
  lists, in order: `PRODUCT BACKLOG`, `Documentos`, `SPRINT 2: Goal Plan de Acción`,
  `Tareas en proceso`, `CÓDIGO - Develop` (already merged into `develop`), `TESTING` (cards are
  moved here when testing starts), `Tareas hechas Sprint 2`, `Tareas hechas Sprint 1`,
  `DOCUMENTACIÓN`. A card moves to `Tareas hechas` only with its Definition of Done fully met. The
  DoD on the Trello card and the one in [docs/PROCESO.md](docs/PROCESO.md) §2 currently differ;
  reconciling them is a pending team decision — do not unify or rewrite either.
- Process rules (definition of done, AI-assisted code convention): [docs/PROCESO.md](docs/PROCESO.md).
- Architecture/scope decisions that cut across more than one HU:
  [docs/DECISIONES.md](docs/DECISIONES.md). A decision specific to a single HU goes in that HU's
  spec, "Decisiones aplicadas" section (`docs/specs/_plantilla.md`), not here.
- API contract: the OpenAPI FastAPI generates (`/docs`). New HUs get a spec in `docs/specs/`
  (criteria, business rules, contract pointer, errors); already-shipped Sprint 1 HUs
  (E02-HU01..04, E02-HU07) are documented in `docs/ESPECIFICACIONES_TECNICAS.md`.
- Requirements for new HUs live in `docs/requisitos/` (Excel, one sheet per HU). A spec in
  `docs/specs/` is the authoritative source only once its `Estado de la Specification:` line says
  `Aprobada`; while it says `Borrador`, the Excel sheet is still the source of truth.
- ID convention: epic-qualified from now on (`E04-HU01`, criteria `E04-HU01-CA05`). Sprint 1's
  unqualified `HU-0N` is equivalent to `E02-HU0N`.
- Every new endpoint declares `response_model`, `summary`, and error `responses` — the generated
  OpenAPI is the contract.
- Real shape of the three source Excel files: [docs/DATOS.md](docs/DATOS.md).
- Security/OWASP: [docs/SEGURIDAD.md](docs/SEGURIDAD.md). Deployment: [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).
- Keycloak login theme source: `keycloak/themes/govsync/` (mounted read-only into the `keycloak`
  service by `docker-compose.yml`). In production Keycloak runs on Render from `keycloak/Dockerfile`
  (D39, [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) §"Keycloak en Render"; pending validation with a real
  deploy); `docker-compose.yml` is local-only.
- Sprint 1 historical docs (plan, CA traceability, test cases) no longer maintained:
  `docs/archivo/sprint-1/`.

## Conventions

Branches: `<tipo>/<identificador-opcional>/<descripcion-corta>`, lowercase, hyphenated, always
branched from `develop` (types: `feature`, `bugfix`, `refactor`, `docs`, `test`, `chore`). Never
commit directly to `develop` or `main`.

Commits: [Conventional Commits](https://www.conventionalcommits.org/) —
`<tipo>(<alcance>): <descripción en presente, minúscula>`, header ≤72 chars (enforced by
commitlint). Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`. Scopes in
use: `cortes`, `ingesta`, `trazabilidad`, `dominio`, `bd`, `frontend`, `seguridad`, `plan-accion`,
`specs`, `deps`, `deps-dev`, `ci`, `despliegue`.

Full guidance on branch/commit workflow and sprint mechanics: [CONTRIBUTING.md](CONTRIBUTING.md).

## Working with AI assistance

- Never `git push`, open a PR or merge without an explicit order from the user; an order covers
  only the actions it names.
- AI-assisted PRs carry the `[IA-ASISTIDO]` mark (tool + validation, see
  `.github/pull_request_template.md`). Co-authorship credit (Claude Sonnet 5.5) goes only in the PR
  description, never as a commit trailer. Commit messages and PR text are in Spanish.
- Do not touch `.claude/`.
- Do not move or edit Trello cards without an explicit order.
- In reports, separate "lo leí" (verified in code or output) from "lo supongo" (inferred).
- If sources contradict each other, stop and ask; do not pick one.
- Source of truth, highest first: approved spec (`Estado de la Specification: Aprobada`) >
  requirements Excel (`docs/requisitos/`) while the spec is `Borrador` > the backend's OpenAPI >
  Trello (status only).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
