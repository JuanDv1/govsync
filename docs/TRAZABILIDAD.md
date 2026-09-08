# Trazabilidad HU → CA → Código → Prueba — Sprint 1

Se llena a medida que avanza el sprint, no al final. Cada fila se marca
cuando el CA correspondiente tiene código Y prueba automatizada pasando —
un CA "implementado" sin prueba no cuenta como hecho (ver Definición de
Terminado en `PLANDETRABAJO.md`, §5).

Estado: `Pendiente` · `En progreso` · `Implementado` · `Probado` (todas las
pruebas de ese CA pasan) · `Bloqueado` (anotar por qué en Evidencia).

---

## E-02 / HU-01 — Crear corte de seguimiento (8 SP)

| CA | Tarjeta(s) | Archivo | Estado | Prueba | Evidencia |
| --- | --- | --- | --- | --- | --- |
| CA-1 (registro exitoso, parcial) | `[HU-01][BE-03]` | `cortes/application/casos_uso.py` | Pendiente | — | — |
| CA-2 (rechaza fecha futura) | `[HU-01][BE-01]` | `cortes/domain/entidades.py::Corte.validar_fecha` | Pendiente | — | — |
| CA-3 (no registra sin archivos completos) | `[HU-01][BE-05]` | `cortes/application/casos_uso.py::registrar_corte` | Pendiente | — | — |
| CA-4 (registro exitoso completo) | `[HU-01][BE-01]`, `[HU-01][BE-05]` | `entidades.py`, `casos_uso.py` | Pendiente | — | — |
| CA-5 (reutilización automática PDT + municipio) | `[HU-01][BE-04]` | `entidades.py` + `casos_uso.py` | Pendiente (bloqueado por D3) | — | — |
| CA-6 (opción de reemplazar reutilizados) | `[HU-01][BE-04]` | idem | Pendiente | — | — |
| CA-7 (archivo de ejecución siempre solicitado) | `[HU-01][BE-04]` | idem | Pendiente | — | — |
| CA-8 (endpoint) | `[HU-01][FE-01]` | `cortes/api/router.py` | Pendiente | — | — |

## E-02 / HU-02 — Cargar Plan Indicativo (3 SP)

| CA | Tarjeta(s) | Archivo | Estado | Prueba | Evidencia |
| --- | --- | --- | --- | --- | --- |
| CA-1 (reconoce pestaña "Plan indicativo - Productos") | `[HU-02][BE-01]` | `ingesta/persistence/lectores/pdt.py` | Pendiente | — | — |
| CA-2 (rechazo por columnas faltantes, nombradas) | `[HU-02][BE-02]` | `lectores/pdt.py::OBLIGATORIAS` | Pendiente | — | — |
| CA-3 (confirmación visual de metas cargadas) | `[HU-02][FE-02]` | `pages/NuevoCorte.jsx` paso 2 | Pendiente | — | — |
| CA-4 (rechazo por archivo incorrecto) | `[HU-02][BE-03]` | `lectores/pdt.py::leer` | Pendiente | — | — |
| CA-5 (alimenta matriz de relación) | `[HU-02][BE-04]` | `casos_uso.py::cargar_archivo` | Pendiente | — | — |

## E-02 / HU-03 — Cargar información presupuestal y contractual (8 SP)

| CA | Tarjeta(s) | Archivo | Estado | Prueba | Evidencia |
| --- | --- | --- | --- | --- | --- |
| CA-1 (endpoint) | `[HU-03][FE-01]` | `cortes/api/router.py` | Pendiente | — | — |
| CA-2 (procesa ambas pestañas sin exigir carga separada) | `[HU-03][BE-01]`, `[HU-03][FE-02]` | `lectores/ejecucion.py` | Pendiente | — | — |
| CA-3 (equivalencia de nombres de columna de indicador) | `[HU-03][BE-03]` | `_comun.py::mapear_columnas` | Pendiente | — | — |
| CA-4 (rechazo por pestaña faltante, nombrada) | `[HU-03][BE-04]` | `lectores/ejecucion.py::leer` | Pendiente | — | — |
| CA-5 (rechazo por archivo incorrecto) | `[HU-03][BE-05]` | idem | Pendiente | — | — |
| CA-6 (confirmación reporta ambas pestañas por separado) | `[HU-03][FE-02]` | `pages/NuevoCorte.jsx` | Pendiente | — | — |
| CA-7 (preserva ceros a la izquierda) | `[HU-03][BE-02]` | `lectores/_comun.py` (`dtype=str`) | Pendiente | — | — |

## E-02 / HU-04 — Cargar plantilla de proyectos BPIN (13 SP)

| CA | Tarjeta(s) | Archivo | Estado | Prueba | Evidencia |
| --- | --- | --- | --- | --- | --- |
| CA-1 (endpoint) | `[HU-04][FE-01]` | `cortes/api/router.py` | Pendiente | — | — |
| CA-2 (carga tal cual, sin exigir estructura estandarizada) | `[HU-04][BE-01]` | `lectores/proyectos.py` | Pendiente | — | — |
| CA-3 (extracción acotada de columnas) | `[HU-04][BE-02]` | `lectores/proyectos.py::OBLIGATORIAS` | Pendiente | — | — |
| CA-4 (separa indicadores multivalor automáticamente) | `[HU-04][BE-03]` | `shared/codigos.py::extraer_todos` | Pendiente | — | — |

## E-02 / HU-07 — Visualizar matriz de relación del corte (5 SP)

| CA | Tarjeta(s) | Archivo | Estado | Prueba | Evidencia |
| --- | --- | --- | --- | --- | --- |
| CA-1 (visualización con las 6 columnas confirmadas) | `[HU-07][BE-01]`, `[HU-07][FE-01]` | `trazabilidad/persistence/consultas.py`, `api/router.py` | Pendiente | — | — |
| CA-2..CA-6 (consulta y filtros de la matriz) | `[HU-07][BE-01]`, `[HU-07][FE-02]` | idem, `pages/MatrizRelacion.jsx` | Pendiente | — | — |
| CA-4 (unificación de nombres de columna de indicador) | `[HU-07][BE-02]` | `consultas.py` | Pendiente | — | — |
| CA-7 | `[HU-07][BE-02]` | idem | Pendiente | — ver caso frontera documentado en el docstring de `consultas.py` | — |
| CA-8 (conteo total contrastado con el cálculo manual) | `[HU-07][BE-03]`, `[HU-07][FE-03]` | idem, `pages/MatrizRelacion.jsx` | Pendiente | Debe dar: 144 metas · 119 con ejecución · 67 con BPIN · 24 sin cruce (ver `docs/DECISIONES.md`, D4) | — |

---

## Cómo llenar esta tabla

1. Cuando abra una rama para una tarjeta, cambie el Estado a `En progreso`.
2. Cuando el código esté escrito, cambie a `Implementado` y llene el nombre
   real del archivo si difiere del planeado (y anote por qué).
3. Cuando la prueba automatizada exista y pase, cambie a `Probado` y ponga en
   Prueba el nombre de la función de test (ej. `test_rechaza_fecha_futura`).
4. En Evidencia: enlace al PR, o el resultado real de `pytest -k <patrón>` si
   el PR aún no existe.
5. No mueva la tarjeta de Trello a "Tareas hechas" hasta que esta fila diga
   `Probado`.
