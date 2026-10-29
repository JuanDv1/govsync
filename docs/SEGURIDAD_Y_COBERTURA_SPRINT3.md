# Seguridad de dependencias y cobertura — Sprint 3 (DevOps)

Automatización pedida explícitamente ("házlo tú si puedes") dentro del rol de
DevOps que asume ahora Juan Esteban en solitario este sprint. Rama:
`devops/cobertura-ci-y-auditoria-seguridad`, creada sobre
`refactor/plan-accion/unificar-cruce-y-capa-aplicacion` (no sobre `main`),
porque la cobertura de frontend que se automatiza aquí depende de la
infraestructura de Vitest que esa rama trae y que todavía no está en `main`
(PR #192 sin mergear). **Ver "Nota sobre el orden de los PR" al final.**

---

## 1. Qué pide la rúbrica y qué de esto lo cubre

El documento `GovSync_Sprint3_Grupo2.docx` (la plantilla real de entrega,
15 % de la nota) exige para el criterio "Experimentos / Resultados / Diseño
de Pruebas y Rendimiento":

- Cobertura de código **verificada** (>70 %).
- Análisis final de seguridad (OWASP Top 10).
- (Pruebas de carga con k6 — ya resuelto en el refactor anterior, no se
  toca aquí.)

Backend ya cumplía la parte de cobertura (`--cov-fail-under=70` en CI,
confirmado leyendo `ci.yml` antes de tocar nada — no se duplicó). Lo que
faltaba y se automatiza en esta rama:

1. Cobertura de **frontend** visible y documentada en cada build (hoy no
   existía ningún reporte, solo corría en local si alguien se acordaba).
2. Un primer análisis de seguridad **real**, no una afirmación sin
   evidencia (la propia plantilla señala eso como el ejemplo incorrecto a
   evitar): SAST del código propio (bandit) + auditoría de vulnerabilidades
   conocidas en dependencias (pip-audit), relevante para "Validación de
   entradas", "Manejo de tokens" y "Exposición de información sensible" de
   las reglas de seguridad del proyecto.

---

## 2. Backend — auditoría de seguridad (`backend-seguridad`, nuevo job en CI)

### 2.1 Bandit (análisis estático del código propio)

Resultado real corriendo `bandit -r app -ll` contra el código actual:

```
Total issues (by severity):
    Low: 1   Medium: 0   High: 0
```

El único hallazgo (`B101: assert_used`, severidad Low) es un `assert` en
`app/modules/ingesta/persistence/lectores/ejecucion.py:236` que se elimina
al compilar con bytecode optimizado — no es un riesgo de seguridad
explotable, es una observación de robustez. No se corrigió en este paso: no
afecta al umbral `-ll` (medium/high) y tocar lógica de reintento de lectura
de Excel merece su propio diagnóstico, no un cambio de paso dentro de esta
tarjeta de DevOps.

### 2.2 pip-audit (vulnerabilidades conocidas en dependencias) — HALLAZGO REAL, CORREGIDO

`pip-audit -r requirements.txt` encontró **29 vulnerabilidades conocidas en
3 paquetes** antes de este cambio:

| Paquete | Versión anterior | # CVE/PYSEC | Versión mínima que corrige todo | Por qué importa |
| --- | --- | --- | --- | --- |
| `cryptography` | 46.0.3 | 5 (incl. GHSA-537c-gmf6-5ccf) | **50.0.0** | Usada por PyJWT para validar firmas de los JWT de Keycloak |
| `PyJWT` | 2.13.0 | 14 (PYSEC-2026-4140 a 4183) | **2.15.0** | Es literalmente la librería de "Manejo de tokens" del backend |
| `dnspython` | 2.8.0 (transitiva, vía `email-validator`) | 1 (CVE-2026-114605) | **2.9.0** | Transitiva, se fuerza con un pin explícito |

**Corrección aplicada:** se subieron los tres pines en `requirements.in` y
se recompiló con `uv pip compile --generate-hashes` (mismo mecanismo que ya
usa el proyecto). `pip-audit` contra el `requirements.txt` resultante ya no
reporta ninguna vulnerabilidad conocida.

`requirements-dev.txt` tenía además `certifi 2026.7.22` con una CVE
(PYSEC-2026-4320, transitiva de `pip-audit`/`httpx`) — se fijó
`certifi==2026.10.19` explícitamente por el mismo mecanismo. También limpio
tras recompilar.

**DECISIÓN QUE NO TOMÉ SOLO — por qué lo señalo en vez de solo mergearlo:**
subir `cryptography` de 46 a 50 es un salto de 4 versiones mayores de una
librería criptográfica que PyJWT usa para validar tokens de Keycloak. Es el
tipo de cambio que el proyecto pide no decidir en silencio (afecta
seguridad/autenticación). Antes de proponerlo aquí:

- Se validó que `uv pip compile` resuelve sin conflictos de versión con el
  resto de dependencias ancladas.
- Se instaló con `pip install --require-hashes --only-binary ":all:"` bajo
  **Python 3.12 real** (no el 3.10 del dispositivo, que no cumple el
  requisito del proyecto) en un clon limpio, y se corrió la suite completa
  de `pytest` del backend contra esas versiones nuevas:
  **toda la suite pasó (exit code 0), cobertura 98 %, sin ningún `F`/`E` en
  la salida.** El bump queda validado contra el comportamiento real del
  backend, no solo contra la resolución de dependencias.

**Lo que NO se automatizó a propósito:** el job `backend-seguridad` corre
con `continue-on-error: true` en los dos pasos de auditoría. Es la primera
vez que esto corre en CI — convertirlo en un gate que bloquea merges es una
decisión del equipo (¿qué severidad es aceptable? ¿bandit en qué nivel?),
no algo que yo deba decidir solo. El reporte queda publicado como artefacto
(`seguridad-backend`, 30 días) para que el equipo lo revise y decida.

---

## 3. Frontend — cobertura en CI (reporte, no gate)

Se agregó `npm run test:coverage` al job `test` de CI y se publica el
resultado (`frontend/coverage`, HTML+lcov) como artefacto
(`cobertura-frontend`, 7 días).

**DECISIÓN QUE NO TOMÉ SOLA:** no se agregó ningún `coverage.thresholds` en
`vitest.config.js` que haga fallar el build. Hoy la única suite real de
frontend es `filtrosPlanAccion.test.js` (22 casos, un solo archivo de
`src/lib`); el grueso de `src/` (`PlanAccion.jsx`, `CompararCortes.jsx`,
etc.) no tiene pruebas todavía. Poner aquí el mismo piso del 70 % que exige
el backend bloquearía inmediatamente todos los PR por un número que no
refleja una regresión real sino cobertura que aún no se ha escrito — eso es
exactamente la sobreingeniería/el bloqueo prematuro que el proyecto pide
evitar. El número queda visible y documentado (que es lo que exige la
rúbrica); **el equipo decide cuándo y en qué valor convertirlo en gate**,
editando el bloque `test.coverage.thresholds` de `vitest.config.js`.

---

## 4. Qué queda pendiente / para el equipo

1. **Revisar y aprobar (o pedir cambios) el bump de `cryptography`/`PyJWT`**
   antes de mergear esta rama — ver evidencia de validación en la sección
   2.2.
2. **Decidir si/cuándo** `backend-seguridad` deja de ser `continue-on-error`
   y bloquea merges, y con qué severidad.
3. **Decidir si/cuándo** la cobertura de frontend obtiene un umbral real en
   `vitest.config.js` (probablemente cuando se escriban las pruebas
   pendientes de `PlanAccion.jsx`/`CompararCortes.jsx` que ya quedaron
   anotadas en `docs/REFACTOR_PLAN_ACCION_SPRINT3.md`).
4. El análisis OWASP de la rúbrica pide algo "final" (una vez, no
   continuo) — estos dos reportes (bandit + pip-audit) son el insumo real
   para escribirlo cuando se acerque la entrega, en vez de la afirmación
   sin evidencia que la propia plantilla marca como ejemplo incorrecto.

## 5. Nota sobre el orden de los PR

Esta rama sale de `refactor/plan-accion/unificar-cruce-y-capa-aplicacion`
(PR #192, todavía sin mergear) porque la parte de cobertura de frontend no
tiene sentido sin el `vitest.config.js` que esa rama introduce. Dos
opciones, a decidir por el equipo:

- Abrir el PR de esta rama apuntando a `refactor/plan-accion/...` en vez de
  a `main`, y mergear ambos en orden (refactor primero, luego este).
- O esperar a que el PR #192 se mergee a `main` y entonces rebasar esta
  rama sobre `main`.

No elegí una por el equipo — ambas son válidas, solo cambia el orden de
revisión.
