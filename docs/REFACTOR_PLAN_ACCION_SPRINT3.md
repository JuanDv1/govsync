# Refactor de Plan de Acción — Sprint 3 (DevOps)

Propuesta de refactorización del módulo `plan_accion` (el que el equipo
marcó como prioritario este sprint) y automatización del análisis de
Sprint 1/2. Rol asumido: DevOps, modo AS-A-JUDGE del proyecto (revisar
activamente, no aprobar por defecto).

Rama: `refactor/plan-accion/unificar-cruce-y-capa-aplicacion` (no
publicada/pusheada todavía — ver "Próximo paso" al final).

---

## 1. Qué se implementó (autorizado explícitamente: "házlo y automatízalo")

### 1.1 Unificar el cruce de 4 fuentes duplicado — HECHO

**Problema:** `trazabilidad/persistence/consultas.py::_construir_consulta_base`
y `plan_accion/persistence/consultas.py::construir_filas_plan_accion`
construían el MISMO cruce (meta/proyecto/rubro/contrato, con las mismas 3
reglas invioables: `ultimo_nivel`, LEFT JOIN, puente deduplicado) con dos
bloques de código copiados byte a byte. El propio docstring de
`plan_accion` ya documentaba por qué existía la duplicación: cada HU
proyecta columnas distintas, y el equipo decidió no acoplar un módulo al
otro para no arriesgar romper HU-07 al tocarla por otra HU.

**Qué se hizo:** se extrajo la parte 100% idéntica (las dos subconsultas-
puente + la cadena de 4 LEFT JOIN) a `app/shared/persistence/
cruce_fuentes.py::construir_cruce_fuentes`. Cada módulo sigue eligiendo sus
propias columnas (se le pasa una función que las construye) y **ninguno
importa del otro** — se mantiene la razón original de la duplicación,
solo se elimina el copy-paste real.

**Por qué esa ubicación:** `tests/test_arquitectura.py` prohíbe SQLAlchemy
en los archivos hijos directos de `shared/`, pero no en un subpaquete como
`shared/persistence/` — verificado leyendo ese test antes de crear el
archivo, para no violar la regla de dependencias del dominio.

**Validación:** suite completa del backend (todos los `tests/`, SQLite en
memoria) sin regresiones, antes y después del cambio. `ruff check` y
`ruff format` limpios. Se agregó una prueba de regresión en
`test_arquitectura.py` que falla si algún módulo deja de importar
`construir_cruce_fuentes` — para que la duplicación no pueda reaparecer
sin que algo la detecte.

**Commit:** `3d3c07c` — `refactor(plan_accion,trazabilidad): unificar
cruce de 4 fuentes duplicado`.

### 1.2 Automatizar pruebas de frontend (pedido explícitamente) — HECHO

El job "Tests" del CI era un no-op silencioso: `npm test` corría
`--workspaces --if-present`, y el workspace de frontend no tenía ningún
script `test`. Se agregó Vitest 5 + jsdom + Testing Library + jest-dom +
user-event + MSW como devDependencies (0 vulnerabilidades, confirmado con
`npm audit`), config separada (`vitest.config.js`) y una primera prueba
real: 22 casos sobre `src/lib/filtrosPlanAccion.js` (el único módulo de
`src/lib` con lógica de negocio replicada del backend — normalización de
texto, combinación AND/OR de HU02-CA02 a CA06/CA09, cálculo del resumen),
cada caso referenciando el CA que cubre.

**No se tocó `.github/workflows/ci.yml`:** el job ya invocaba `npm test`
correctamente, solo le faltaba un script real que ejecutar. Validado en
un clon limpio (fuera de este dispositivo — ver nota técnica abajo):
`npm ci --ignore-scripts && npm test`, `npm run lint`, `npm run
format:check`, los tres limpios, replicando exactamente los jobs del CI.

**Commit:** `03c2e79` — `test(frontend): agregar Vitest/RTL/MSW y primera
prueba unitaria real`.

**Pendiente, no cubierto ahora (alcance deliberadamente acotado a una
primera prueba real, no a cobertura completa):** pruebas de
`PlanAccion.jsx` y `CompararCortes.jsx` (1016 y 768 líneas, sin ninguna
prueba). Se recomienda abordarlos en una tarjeta aparte, con MSW
simulando `/plan-accion/actual` y `/comparar` — ya quedó instalado y
configurado, falta escribirlas.

### 1.3 Script de carga k6 (pedido explícitamente) — HECHO, con una decisión importante

`backend/tests/perf/k6_plan_accion.js`: mide `GET /plan-accion/actual`
(70% del tráfico simulado), `/exportar` (15%) y `/comparar` (15%) bajo
carga concurrente, con umbrales p95 por endpoint.

**DECISIÓN QUE NO TOMÉ SOLO, la señalo:** no lo automaticé para correr en
cada PR. Los 3 endpoints exigen un JWT real de Keycloak, y el job
`backend-keycloak` del CI **solo** verifica que la imagen arranca — su
propio comentario dice "no crea realm/cliente/rol ni valida un token real
— eso es una tarjeta siguiente". Generar o asumir un token dentro de este
refactor habría sido fabricar un supuesto de seguridad no verificado
("nunca conviertas una suposición en un requisito"). En su lugar:
`.github/workflows/perf.yml`, disparo **solo manual**
(`workflow_dispatch`), recibe el token por secreto de repositorio
(`K6_PLAN_ACCION_TOKEN`) que alguien del equipo debe generar a mano con
un login real.

**Pendiente real para automatizarlo del todo:** crear el realm/cliente/
usuario de prueba en el job `backend-keycloak` (la tarjeta que ese mismo
job ya señala como pendiente). Mientras no exista, correr k6 contra CI en
cada PR no es posible sin inventar algo.

**Commit:** `5bc7e94` — `test(perf): agregar script k6 de carga para
Plan de Accion`.

---

## 2. Qué se analizó pero NO se implementó — para que el equipo decida

### 2.1 Capa de aplicación para `plan_accion/api/router.py` — NO IMPLEMENTADO (a propósito)

Mi plan inicial (antes de leer el archivo completo) era extraer una capa
`application/` para mover la orquestación de `_verificar_fuentes_completas`,
`_validar_y_ordenar_cortes`, `_comparar_y_filtrar`, etc. **Al leer el
router encontré que esa decisión YA fue tomada y documentada por el
equipo**, en el propio docstring del módulo:

> "ALCANCE Y PATRÓN: igual que `trazabilidad/api/router.py` -- sin capa de
> `application/` propia [...] Agregar una capa de aplicación aquí
> envolvería esas 4 llamadas en una clase sin estado y sin ninguna regla
> propia -- indirección sin beneficio [...]"

Implementar mi plan original habría sido revertir en silencio una
decisión de arquitectura ya razonada y documentada — exactamente lo que
las instrucciones de este proyecto piden no hacer. **No lo hice.**

**Para que el equipo decida** (presento ambas alternativas, no recomiendo
una por encima de la decisión ya tomada sin que el equipo la reabra):

| Alternativa | A favor | En contra |
|---|---|---|
| **Mantener sin capa de aplicación** (statu quo, recomendado si nada cambió desde que se decidió) | Es lo que el propio código ya razona: caso de uso simple, de solo lectura, sin transacciones ni orquestación entre repositorios — una clase envolviendo 4 llamadas sin estado es indirección sin beneficio real. | Si el router sigue creciendo (ya tiene 711 líneas, 5 endpoints), el argumento "es simple" puede dejar de sostenerse. |
| **Extraer una capa de aplicación** | Centraliza las reglas 409/422 de `_validar_y_ordenar_cortes` en un lugar probable por `pytest` sin pasar por FastAPI; coherencia total con el diagrama de 5 capas. | Contradice una decisión ya tomada y razonada por el equipo para este mismo patrón (trazabilidad + plan_accion); el propio proyecto pide no sobreingeniería ("si una solución simple cumple mejor los CA y la arquitectura, prefiera la simple"). |

**Mi lectura, sin decidir por el equipo:** el router de `plan_accion` (711
líneas) es casi el doble que el de `trazabilidad` (296 líneas) que
originó el patrón. Si el equipo cree que ya pasó el punto en el que "es
simple" deja de ser cierto, vale la pena reabrir la decisión — pero es una
decisión del equipo, no algo para que yo cambie solo.

### 2.2 Hallazgos de SonarCloud (cognitive complexity, duplicación de
literales) — NO ABORDADOS en este paso

Siguen pendientes de la revisión anterior: `agregar_por_meta`
(`domain/entidades.py:137`, complejidad 17), `domain/comparacion.py:76`
(complejidad 16), `shared/codigos.py:206` (complejidad 19). No se tocaron
en este refactor para mantenerlo acotado al cruce duplicado y a lo
explícitamente pedido (k6, frontend). Recomiendo una tarjeta aparte —
tocar lógica de dominio (reglas de negocio reales, no solo estructura de
consulta) merece su propio diagnóstico y pruebas, no un cambio de paso
dentro de este refactor.

---

## 3. Nota técnica sobre esta sesión

El refactor de Python se desarrolló y validó en el entorno local
(Python 3.10 + venv con parche de compatibilidad para
`datetime.UTC`/`enum.StrEnum`, ya que el proyecto pide 3.12+). La
instalación de dependencias npm del frontend, en cambio, fue poco
confiable a través del puente a este dispositivo (errores `ENOTEMPTY`
repetidos al renombrar directorios de `node_modules` sobre el disco de
Windows) — se validó en un clon temporal fuera del dispositivo y se
transfirieron únicamente los archivos fuente (nunca `node_modules`, que
es un artefacto ignorado por git). **Recomendado:** correr `npm install`
una vez de forma local (fuera de este puente) antes de `npm test`.

---

## 4. Próximo paso recomendado

1. Revisar esta propuesta y la sección 2 en equipo (decisión de capa de
   aplicación: statu quo vs. reabrir).
2. Correr `npm install` local una vez (nota técnica arriba) y confirmar
   `npm test` localmente.
3. Si el equipo aprueba, pushear la rama
   `refactor/plan-accion/unificar-cruce-y-capa-aplicacion` y abrir el PR
   (no se hizo sin pedirlo explícitamente, según la preferencia ya
   establecida del equipo).
4. Tarjeta aparte para: pruebas de `PlanAccion.jsx`/`CompararCortes.jsx`,
   hallazgos de SonarCloud (complejidad), y crear el realm/usuario de
   prueba de Keycloak en CI (requisito real para automatizar k6 del todo).
