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
docker compose up -d  # Postgres 16 only — backend and frontend run locally for hot reload
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
between indicators, budget execution, and BPIN projects). `alertas/` and `avance_fisico/` exist as
empty module directories (`.gitkeep` only, no code) — placeholders for future épicas, not stubs to
fill in without a card. Shared kernel: `app/shared/codigos.py`
(the `CodigoIndicadorProducto` value object — the 9-digit key that joins all four data sources;
**always store as text, never as int**, since real codes like `040110500` start with a leading
zero) and `app/shared/errors.py` (`GovSyncError` hierarchy — domain exceptions in Spanish, no
`Error` suffix required since they read as domain phrases, e.g. `ArchivoInvalido`,
`ReglaDeNegocioViolada`). `app/core/` holds cross-cutting config (`config.py`, env-var driven,
no usable prod defaults for secrets), DB session (`database.py`), FastAPI dependencies
(`dependencias.py`), and the single exception-to-HTTP translation point (`errores.py`).

Authentication stays out of scope (`[REF-05]`, see `docs/DECISIONES.md` D2) — don't add auth
scaffolding unless a card explicitly asks for it.

File upload rules (`[SEC-03]`, enforced in `cortes/application/casos_uso.py`, not in the API
layer): only `.xlsx`, size checked before reading into memory, filename sanitized against path
traversal, macro-enabled `.xlsm` rejected outright, required sheets validated before processing.
An invalid file is rejected **in full** — never partial data.

Frontend (`frontend/src/`): `api/cliente.js` is the shared HTTP client (`[UX-01]`), implemented —
`solicitar()` and the `api` methods (`crearCorte`, `listarCortes`, `obtenerCorte`, `registrarCorte`,
`cargarArchivo`, `matriz`) are wired to the backend. It preserves `error.detalles` from failed
requests (carries `columnas_faltantes`, `pestanas_faltantes`, `archivos_faltantes` from the backend
so the UI can show actionable messages, not just "failed") — `ErrorApi` models this shape.
`components/` holds shared UI (`Estados.jsx` for loading/error/empty states, `EstadoError`
implemented; `CargaDeArchivo.jsx`, implemented drag-and-drop upload control shared by the three
source-file uploads, `[UX-02]`), `pages/` holds route-level screens (`NuevoCorte.jsx`, `Cortes.jsx`,
`MatrizRelacion.jsx`, `Login.jsx`) wired into `App.jsx`'s router (`/login`, `/cortes`,
`/cortes/nuevo`, `/cortes/:corteId`, `/matriz/:corteId?`).

## Where things live

- Card status, priority, owner, estimate: **Trello only** — no Markdown file replicates it. List
  flow: `Sprint2` → `Tareas en proceso` → `Código (PR abierto)` → `Testing` (in `develop`) →
  `Tareas hechas` (in `main`).
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
- Sprint 1 historical docs (plan, CA traceability, test cases) no longer maintained:
  `docs/archivo/sprint-1/`.

## Conventions

Branches: `<tipo>/<identificador-opcional>/<descripcion-corta>`, lowercase, hyphenated, always
branched from `develop` (types: `feature`, `bugfix`, `refactor`, `docs`, `test`, `chore`). Never
commit directly to `develop` or `main`.

Commits: [Conventional Commits](https://www.conventionalcommits.org/) —
`<tipo>(<alcance>): <descripción en presente, minúscula>`, header ≤72 chars (enforced by
commitlint). Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`. Scopes in
use: `cortes`, `ingesta`, `trazabilidad`, `dominio`, `bd`, `frontend`, `seguridad`.

Full guidance on branch/commit workflow and sprint mechanics: [CONTRIBUTING.md](CONTRIBUTING.md).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
