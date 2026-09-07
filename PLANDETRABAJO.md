# Plan de trabajo — Sprint 1

Orden de implementación de las 59 tarjetas del tablero, con quién hace qué,
qué archivo toca, qué criterio de aceptación cubre y cuándo se puede empezar.

**Este documento existe para resolver un problema concreto:** cuatro personas
pidiéndole código a una IA por separado producen cuatro estilos, cuatro formas
de manejar errores y cuatro interpretaciones del mismo CA. El resultado no
compila junto aunque cada parte funcione.

La solución no es dejar de usar IA. Es que las cuatro conversaciones partan del
**mismo contrato**: el mismo archivo destino, el mismo puerto, la misma
excepción, el mismo criterio. Eso es lo que este documento y los _stubs_ del
esqueleto le dan a cada quien.

---

## 1. Reglas del juego

Léanlas antes de escribir la primera línea. Son cinco y evitan el 90 % de los
choques.

### R1 · Nadie crea archivos que no estén en su tarjeta

El esqueleto ya tiene la estructura completa. Cada tarjeta dice qué archivo
toca. Si siente que necesita uno nuevo, primero pregunte en el grupo: casi
siempre significa que la lógica va en un archivo que ya existe, en otra capa.

### R2 · El contrato está en el _stub_, no en la conversación con la IA

Cada archivo del esqueleto tiene un docstring con su capa, su tarjeta, sus CA y
las trampas conocidas de los datos reales. **Ese docstring es el contrato.**
Cuando le pida código a la IA, péguele el archivo completo (§7 tiene la
plantilla). Si la IA propone cambiar la firma de un método público o mover algo
de capa, no lo acepte sin avisar al grupo: esa firma es de la que dependen los
demás.

### R3 · La prueba de arquitectura manda

`backend/tests/test_arquitectura.py` analiza el código y **rompe la build** si:

- el dominio importa FastAPI, SQLAlchemy, pandas, openpyxl o Pydantic;
- la capa de aplicación importa FastAPI;
- un router consulta la base directamente;
- pandas u openpyxl aparecen fuera de `persistence/`.

No la desactive. Si su tarjeta parece exigir romperla, es que la lógica va en
otra capa.

### R4 · Un CA sin prueba no está terminado

La rúbrica evalúa trazabilidad **HU → CA → código → prueba → evidencia**. Cada
tarjeta de este plan trae la prueba mínima que la cierra. Sin ella, la tarjeta
no pasa a "Tareas hechas".

### R5 · Commits pequeños y en orden

El docente revisa el historial. Un solo commit gigante al final vale menos que
quince commits que cuentan cómo se construyó. Cada tarjeta de este plan trae su
mensaje de commit sugerido, en Conventional Commits.

---

## 2. Reparto

Según `[REF-06]`: dos pares por capa, y **cada quien revisa la capa que no
escribió**.

| Integrante       | Capa                                      | Tarjetas | Aprobación obligatoria de       |
| ---------------- | ----------------------------------------- | -------- | ------------------------------- |
| **Juan Esteban** | Backend — dominio y casos de uso          | 17       | PR de dominio, migraciones y BD |
| **Cristhian**    | Backend — persistencia, ETL, CI/seguridad | 19       | PR de validación, secretos y CI |
| **Karold**       | Frontend — pantallas                      | 11       | —                               |
| **Juan David**   | Frontend — endpoints y componentes        | 11       | —                               |

Regla de revisión de `[REF-06]`: backend revisa frontend y viceversa.

---

## 3. Antes de empezar: tres decisiones

No son opcionales. Dos de ellas **bloquean** tarjetas de la Fase 1.

### D1 · ¿La migración de Alembic es la única fuente de verdad del esquema?

**Bloquea `[BD-01]`, y por tanto todo el backend.**

Hoy circulan tres `.sql` más un diagrama E/R paralelo, sin reconciliar. La guía
del proyecto (§5) lo advierte. Mientras no se decida, dos personas pueden
construir sobre esquemas distintos.

Recomendación: sí, y los tres `.sql` quedan como material histórico. Registrar
la decisión en `[REF-01]`.

### D2 · ¿Se mantiene `[REF-05]` (autenticación diferida al Sprint 2)?

La tarjeta registra que E-01 no entra al Sprint 1 y acepta que las filas
Autenticación y Autorización de la Tabla 4 de la rúbrica queden en N/A.

**El esqueleto respeta esa decisión: no incluye autenticación.**

Vale la pena revisarla porque son 2 de las 6 filas de un criterio que pesa
20 %. Si deciden incluirla, es una tarjeta nueva (`[HU-E01-01]`, ~5 SP) que
entra en la Fase 2 y toca `core/dependencias.py` más un módulo
`modules/identidad/`. Si la mantienen, escriban la justificación en la Tabla 4,
no dejen la celda vacía.

### D3 · ¿Qué es «el archivo del municipio» de HU-01/CA-5?

**Pregunta para Emilse.** CA-5 dice que se reutilizan «el PDT y el archivo del
municipio», y hay tres tipos: PDT, EJECUCION y PROYECTOS. Se interpretó que es
la plantilla de proyectos BPIN, por ser la única de las tres que el municipio
diligencia a mano. Si es un cuarto archivo, falta una tabla y cambia
`[HU-01][BE-04]`.

Se puede avanzar con el supuesto documentado, pero hay que preguntarlo.

---

## FASE 0 · Gobernanza — día 1, antes de escribir código

Sin esto, los commits de los demás no siguen convención y hay que reescribir el
historial.

| #   | Tarjeta               | Quién        | Qué hacer                                                                           | Commit                                               |
| --- | --------------------- | ------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0.1 | `[DEV-01]`            | Juan Esteban | Repositorio en GitHub, rama `main` protegida: exige PR + 1 aprobación + CI en verde | `chore: proteger rama main y configurar repositorio` |
| 0.2 | `[DEV-02]`            | Juan Esteban | `npm install` en la raíz activa Husky y commitlint (ya está configurado)            | `chore: activar validación de commits con husky`     |
| 0.3 | `[DEV-03]`            | Juan Esteban | Verificar la plantilla de PR y CODEOWNERS del esqueleto                             | `docs: plantilla de PR y revisión entre pares`       |
| 0.4 | `[REF-01]`            | Cristhian    | Resolver **D1** y dejarlo escrito                                                   | `docs: registrar fuente de verdad del esquema`       |
| 0.5 | `[REF-05]` `[REF-06]` | Juan Esteban | Resolver **D2**, completar la fecha de decisión                                     | `docs: registrar decisiones de alcance y reparto`    |

**Primer commit del proyecto:** subir el esqueleto tal cual.
`chore: estructura inicial del monolito modular de 5 capas` — cubre `[REF-02]`.

Verificación: `cd backend && pytest` debe pasar con 1 prueba (`test_salud`) más
las de arquitectura.

---

## FASE 1 · Cimientos — bloquean a todos los demás

Estas cuatro tarjetas pueden ir en paralelo, pero **hasta que estén, nadie más
puede avanzar**.

### 1.1 `[TRANS-01]` Objeto de valor CodigoIndicador — **Cristhian**

> Es la tarjeta más importante del sprint. Bloquea HU-02, HU-03, HU-04 y HU-07.

**Archivo:** `backend/app/shared/codigos.py`
**Lea el docstring completo antes de escribir.** Tiene la evidencia medida de
por qué la llave es el código MGA y no el SisPT.

Pruebas mínimas (`tests/test_codigos.py`):

- acepta 9 dígitos
- **conserva `040110500`** con su cero inicial
- recupera un cero perdido: `40110500` → `040110500`
- rechaza `12345` (rellenar cualquier número corto fabrica códigos que no existen)
- rechaza `IP-63`
- `extraer_todos` sobre la celda multivalor real devuelve `["459903100", "459902300"]`
- `extraer_todos("$ 1.218.264.452")` devuelve `[]`
- `extraer_todos("202500000050132")` devuelve `[]` (no fragmentar un BPIN)

`feat(dominio): objeto de valor CodigoIndicadorProducto (refs #TRANS-01)`

### 1.2 `[BD-01]` Modelo de dominio y migración inicial — **Cristhian**

**Bloqueada por D1.**
**Archivos:** `backend/app/modules/cortes/persistence/models.py`, `alembic/versions/`

El docstring del archivo lista las 9 tablas y las 7 decisiones de modelo ya
verificadas contra los datos reales. Léalas: cada una evita un defecto concreto.

```bash
alembic revision --autogenerate -m "esquema inicial"
alembic upgrade head
```

Pruebas: la migración aplica y revierte contra PostgreSQL 16.

`feat(bd): esquema inicial y migración de Alembic (refs #BD-01)`

### 1.3 `[UX-01]` Layout, enrutamiento y cliente HTTP — **Karold**

**Bloquea todo el frontend.**
**Archivos:** `frontend/src/{main.jsx,App.jsx,api/cliente.js}`, `components/Disposicion.jsx`

Lo crítico está en `api/cliente.js`: el cliente **no puede descartar
`error.detalles`**. Ahí viajan `columnas_faltantes`, `pestanas_faltantes` y
`archivos_faltantes`, que es lo que convierte «no se pudo cargar» en un mensaje
accionable. Sin eso, `[UX-03]`, HU-02/CA-3 y HU-01/CA-3 no se pueden cumplir.

`feat(frontend): layout base, enrutamiento y cliente HTTP (refs #UX-01)`

### 1.4 `[DEV-04]` `[DEV-05]` Pipeline CI — **Cristhian**

**Archivo:** `.github/workflows/ci.yml` (ya viene armado en el esqueleto)

Verifique que los jobs corren en verde con el esqueleto: lint, pruebas,
migraciones contra PostgreSQL 16, y build del frontend.

`ci: pipeline de build, pruebas y migraciones (refs #DEV-04 #DEV-05)`

---

## FASE 2 · HU-01 — el corte, del que cuelga todo lo demás

> **Empiece por aquí y no por los lectores.** Sin un corte al que asociar
> archivos, las HU-02/03/04 no tienen dónde cargar nada.

### Backend

| #   | Tarjeta          | Quién        | Archivo                              | CA         | Prueba mínima                                                                                |
| --- | ---------------- | ------------ | ------------------------------------ | ---------- | -------------------------------------------------------------------------------------------- |
| 2.1 | `[HU-01][BE-01]` | Juan Esteban | `cortes/domain/entidades.py`         | CA-2, CA-4 | Rechaza fecha futura con el motivo · `archivos_faltantes()` devuelve los 3 en un corte nuevo |
| 2.2 | `[HU-01][BE-02]` | Cristhian    | `cortes/domain/puertos.py`           | —          | (contrato, sin prueba propia)                                                                |
| 2.3 | `[BD-02]`        | Cristhian    | `cortes/persistence/repositorios.py` | —          | Guardar y recuperar un corte · el ORM no se filtra al dominio                                |
| 2.4 | `[HU-01][BE-03]` | Juan Esteban | `cortes/application/casos_uso.py`    | CA-1, CA-8 | Crea el corte en BORRADOR con los 3 archivos faltantes                                       |

> **2.3 tiene una trampa documentada en el docstring del archivo.** Léala. Es
> la que hace que la matriz de HU-07 no muestre ni un contrato, sin error
> visible.

### Frontend

| #   | Tarjeta          | Quién      | Archivo                                         | CA         |
| --- | ---------------- | ---------- | ----------------------------------------------- | ---------- |
| 2.5 | `[UX-04]`        | Karold     | `components/Estados.jsx`                        | —          |
| 2.6 | `[UX-03]`        | Juan David | `components/Estados.jsx::Error`                 | —          |
| 2.7 | `[HU-01][FE-01]` | Juan David | `cortes/api/router.py` + registrar en `main.py` | CA-1, CA-8 |
| 2.8 | `[HU-01][FE-02]` | Karold     | `pages/NuevoCorte.jsx` paso 1                   | CA-1, CA-2 |

> En 2.8: el calendario restringe fechas futuras, **pero el rechazo también
> tiene que venir del backend**. Ocultar la opción en el frontend no es una
> validación. Hay una prueba en 2.1 que lo garantiza.

**Hito de la Fase 2:** se puede crear un corte desde la interfaz y aparece en el
histórico vacío. Commit sugerido al cerrar:
`feat(cortes): crear corte de seguimiento (closes #HU-01-BE-01 ...)`

---

## FASE 3 · Los tres lectores

**Orden recomendado: HU-02 → HU-03 → HU-04.** No es arbitrario:

- **HU-02 es la más simple (3 SP)** y establece el patrón que reutilizan las
  otras dos: localizar pestaña, validar columnas, rechazo total.
- **HU-03 (8 SP)** introduce las dos complicaciones transversales: multi-pestaña
  y preservación de ceros. Conviene resolverlas temprano porque contaminan las
  tres cargas.
- **HU-04 (13 SP)** es la más riesgosa: celdas combinadas y separación
  multivalor. Se hace mejor con el patrón ya asentado.

Los tres lectores pueden escribirse en paralelo **después** de 3.0.

### 3.0 `[SEC-03]` Validador transversal de archivos — **Cristhian** (primero)

**Bloquea HU-02, HU-03 y HU-04.**
**Archivo:** `cortes/application/casos_uso.py` (la tarjeta dice explícitamente
que **no vive en la API**)

Checklist de la tarjeta:

- extensión declarada vs. MIME real del contenido
- tamaño máximo **verificado antes de leer en memoria** (si no, una carga de
  2 GB se lee entera antes de rechazarse)
- sanitización del nombre (path traversal: `../../etc/passwd`)
- **rechazo de libros con macros (`.xlsm`)**
- verificación de que las hojas obligatorias existen antes de procesar

Pruebas: archivo corrupto, vacío, extensión falsa, nombre con `../`, `.xlsm`.

`feat(seguridad): validador transversal de archivos cargados (refs #SEC-03)`

### 3.1 HU-02 · Plan Indicativo

| #     | Tarjeta          | Quién        | Archivo                                  | CA   |
| ----- | ---------------- | ------------ | ---------------------------------------- | ---- |
| 3.1.1 | `[HU-02][BE-01]` | Cristhian    | `lectores/_comun.py` + `lectores/pdt.py` | CA-2 |
| 3.1.2 | `[HU-02][BE-02]` | Cristhian    | `lectores/pdt.py::OBLIGATORIAS`          | CA-3 |
| 3.1.3 | `[HU-02][BE-03]` | Juan Esteban | `lectores/pdt.py::leer`                  | CA-4 |
| 3.1.4 | `[HU-02][BE-04]` | Juan Esteban | `casos_uso.py::cargar_archivo`           | CA-1 |
| 3.1.5 | `[HU-02][FE-01]` | Juan David   | `cortes/api/router.py`                   | CA-1 |
| 3.1.6 | `[UX-02]`        | Juan David   | `components/CargaDeArchivo.jsx`          | —    |
| 3.1.7 | `[HU-02][FE-02]` | Karold       | `pages/NuevoCorte.jsx` paso 2            | CA-5 |

Pruebas mínimas: lee 144 metas del archivo real · ignora las otras 5 pestañas ·
rechaza si falta la columna «Principal», nombrándola · rechaza el archivo de
ejecución subido por error · **no deja datos parciales tras un rechazo**.

`feat(ingesta): lector del Plan Indicativo (closes #HU-02-BE-01)`

### 3.2 HU-03 · Archivo presupuestal

| #     | Tarjeta          | Quién        | Archivo                            | CA         |
| ----- | ---------------- | ------------ | ---------------------------------- | ---------- |
| 3.2.1 | `[HU-03][BE-01]` | Cristhian    | `lectores/ejecucion.py`            | CA-2       |
| 3.2.2 | `[HU-03][BE-02]` | Cristhian    | `lectores/_comun.py` (`dtype=str`) | CA-7       |
| 3.2.3 | `[HU-03][BE-03]` | Juan Esteban | `_comun.py::mapear_columnas`       | CA-3       |
| 3.2.4 | `[HU-03][BE-04]` | Juan Esteban | `lectores/ejecucion.py::leer`      | CA-4       |
| 3.2.5 | `[HU-03][BE-05]` | Cristhian    | `lectores/ejecucion.py::leer`      | CA-5       |
| 3.2.6 | `[HU-03][BE-06]` | Juan Esteban | `casos_uso.py`                     | CA-1       |
| 3.2.7 | `[HU-03][FE-01]` | Juan David   | `cortes/api/router.py`             | CA-1       |
| 3.2.8 | `[HU-03][FE-02]` | Karold       | `pages/NuevoCorte.jsx`             | CA-2, CA-6 |

> **3.2.8:** UN solo control de carga aunque el archivo tenga dos pestañas —lo
> exige CA-2—, con confirmación que reporta ambas por separado. Y sin opción de
> reutilizar (HU-01/CA-7).

Pruebas mínimas: procesa las dos pestañas · encuentra la pestaña llamada
`Formato Resumido Ejecucion Gast` · **conserva `040110500`** · marca los 111
subtotales · no duplica un contrato con varios registros · dice **cuál** pestaña
falta.

### 3.3 HU-04 · Plantilla de proyectos BPIN

| #     | Tarjeta          | Quién        | Archivo                               | CA   |
| ----- | ---------------- | ------------ | ------------------------------------- | ---- |
| 3.3.1 | `[HU-04][BE-01]` | Cristhian    | `lectores/proyectos.py`               | CA-2 |
| 3.3.2 | `[HU-04][BE-02]` | Cristhian    | `lectores/proyectos.py::OBLIGATORIAS` | CA-3 |
| 3.3.3 | `[HU-04][BE-03]` | Juan Esteban | `shared/codigos.py::extraer_todos`    | CA-4 |
| 3.3.4 | `[HU-04][BE-04]` | Juan Esteban | `casos_uso.py`                        | CA-1 |
| 3.3.5 | `[HU-04][FE-01]` | Juan David   | `cortes/api/router.py`                | CA-1 |
| 3.3.6 | `[HU-04][FE-02]` | Karold       | `pages/NuevoCorte.jsx`                | CA-1 |

> Este lector es **deliberadamente más permisivo** que los otros dos. CA-2 dice
> que el archivo se almacena tal cual, «incluso si su estructura interna no está
> completamente estandarizada». No lo endurezca.

Pruebas mínimas: 38 proyectos entre 134 filas · celdas combinadas propagadas ·
`extraer_todos` sobre la celda multivalor real · un BPIN malformado no tumba el
archivo.

---

## FASE 4 · Cerrar HU-01

Ahora que los tres lectores existen, se puede completar el ciclo del corte.

| #   | Tarjeta          | Quién        | Archivo                                     | CA               |
| --- | ---------------- | ------------ | ------------------------------------------- | ---------------- |
| 4.1 | `[HU-01][BE-04]` | Juan Esteban | `entidades.py` + `casos_uso.py`             | CA-5, CA-6, CA-7 |
| 4.2 | `[HU-01][BE-05]` | Cristhian    | `casos_uso.py::registrar_corte`             | CA-3, CA-4       |
| 4.3 | `[HU-01][FE-03]` | Karold       | `pages/NuevoCorte.jsx` + `pages/Cortes.jsx` | CA-3..CA-7       |

Pruebas mínimas de 4.1 y 4.2:

- con 2 de 3 archivos, registrar **falla indicando cuál falta** y el corte sigue
  en BORRADOR
- con los 3, pasa a REGISTRADO y aparece en el histórico
- un segundo corte de la misma vigencia trae el PDT y la plantilla ya cargados
- **los datos reutilizados se copian, no se comparten**: ninguna fila pertenece
  a dos cortes
- el archivo de ejecución se sigue pidiendo

`feat(cortes): reutilización de fuentes y registro del corte (closes #HU-01)`

---

## FASE 5 · HU-07 — la matriz de relación

Es la HU que demuestra el valor del producto en la sustentación.

| #   | Tarjeta          | Quién        | Archivo                                 | CA         |
| --- | ---------------- | ------------ | --------------------------------------- | ---------- |
| 5.1 | `[HU-07][BE-01]` | Juan Esteban | `trazabilidad/persistence/consultas.py` | CA-2..CA-6 |
| 5.2 | `[HU-07][BE-02]` | Cristhian    | idem                                    | CA-7       |
| 5.3 | `[HU-07][BE-03]` | Juan Esteban | idem                                    | CA-8       |
| 5.4 | `[HU-07][FE-01]` | Juan David   | `trazabilidad/api/router.py`            | CA-1       |
| 5.5 | `[HU-07][FE-02]` | Karold       | `pages/MatrizRelacion.jsx`              | CA-3..CA-6 |
| 5.6 | `[HU-07][FE-03]` | Karold       | idem                                    | CA-8       |
| 5.7 | `[HU-07][FE-04]` | Juan David   | idem                                    | —          |

**Lea el docstring de `consultas.py` completo antes de 5.1.** Tiene las tres
reglas que no se pueden romper y explica el caso que _parece_ violar CA-7 y no
lo es.

Pruebas obligatorias de `[HU-07][BE-02]`:

- un indicador con **dos BPIN** → aparecen ambos
- un BPIN con **tres indicadores** → aparecen los tres
- conteo total de filas contrastado con el cálculo manual esperado
  (**más filas de las esperadas también es un defecto**)

Resultado esperado con los archivos reales: **144 metas · 119 con ejecución ·
67 con BPIN · 24 sin ningún cruce.** Si sus cifras no dan esto, algo está mal en
el cruce.

`feat(trazabilidad): matriz de relación del corte (closes #HU-07)`

---

## FASE 6 · Cierre del sprint

| #   | Tarjeta               | Quién                 | Nota                                                                                                                                                    |
| --- | --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | `[HU-04][FE-03]`      | Juan David            | Vista previa de códigos extraídos **y descartados**, con el motivo. La tarjeta dice que «los descartes son la información más valiosa de esta pantalla» |
| 6.2 | `[DEV-06]`            | Cristhian             | SonarCloud (requiere crear el proyecto y el secreto `SONAR_TOKEN`) + CodeQL, que ya funciona sin credenciales                                           |
| 6.3 | `[SEC-01]`            | Cristhian             | Completar `docs/SEGURIDAD.md` con lo realmente verificado                                                                                               |
| 6.4 | `[SEC-02]`            | Cristhian             | Confirmar que ningún `.env` llegó al repositorio                                                                                                        |
| 6.5 | `[DEV-07]`            | Juan David            | **Despliegue.** Render + Vercel, deploy al mergear a `main`, `/health` respondiendo, CORS restringido al dominio del frontend                           |
| 6.6 | `[REF-03]` `[REF-04]` | Juan Esteban / Karold | Backlog refinado y referencias IEEE                                                                                                                     |

> **6.5 es la brecha más cara si se queda sin hacer.** La rúbrica §4.1 exige
> explícitamente «despliegue automatizado a un ambiente de pruebas». Nótese que
> la tarjeta pide el endpoint en `/health`; el esqueleto lo tiene en
> `/api/v1/salud` — unifiquen el nombre.

---

## 4. Bloqueos — qué no se puede empezar sin qué

```
[REF-01] ──► [BD-01] ──► [BD-02] ──► casos de uso ──► endpoints ──► pantallas
                                          ▲
[TRANS-01] ───────────────────────────────┤ (bloquea HU-02, 03, 04, 07)
                                          │
[SEC-03] ─────────────────────────────────┘ (bloquea las tres cargas)

[UX-01] ──► [UX-02] [UX-03] [UX-04] ──► todas las pantallas

HU-01 ──► HU-02 ──► HU-03 ──► HU-04 ──► HU-07
```

`[TRANS-01]`, `[UX-01]` y `[DEV-04/05]` pueden empezar **hoy**, sin esperar nada.

---

## 5. Definición de terminado

Antes de mover una tarjeta a «Tareas hechas»:

- [ ] Todos los CA de la tarjeta implementados
- [ ] Cada CA tiene al menos una prueba automatizada que lo verifica
- [ ] `pytest` pasa y la cobertura no baja del 70 %
- [ ] `ruff check .` y `ruff format --check .` limpios
- [ ] Datos inválidos y casos borde probados
- [ ] Migración incluida si cambió el esquema
- [ ] `pytest tests/test_arquitectura.py` en verde
- [ ] Fila agregada a `docs/TRAZABILIDAD.md`
- [ ] Si usó IA: PR marcado con la convención y prompt en `docs/BITACORA-IA.md`
- [ ] Revisado por alguien de la **otra** capa (`[REF-06]`)

---

## 6. Convención de commits

```
feat(cortes): crear corte de seguimiento (refs #HU-01-BE-03)
fix(ingesta): conservar ceros a la izquierda en el código de indicador
test(trazabilidad): un indicador con dos BPIN aparece dos veces
refactor(dominio): extraer invariante de fecha a la entidad
docs: registrar decisión sobre la fuente de verdad del esquema
chore: activar husky y commitlint
ci: agregar job de migraciones contra PostgreSQL 16
```

Ámbitos: `cortes`, `ingesta`, `trazabilidad`, `dominio`, `bd`, `frontend`,
`seguridad`. Máximo 72 caracteres en el encabezado (lo valida commitlint).

---

## 7. Cómo pedirle código a la IA sin crear un Frankenstein

Esta es la parte que resuelve el problema que les preocupa. **Usen esta
plantilla, los cuatro, siempre.**

```
Trabajo en GovSync, un monolito modular en 5 capas (API, Aplicación,
Dominio, Persistencia, BD). Las dependencias apuntan HACIA el dominio.

TAREA: [pegue el nombre de la tarjeta de Trello]

ARCHIVO A IMPLEMENTAR: [ruta]

Este es el archivo actual, con su contrato en el docstring:
[PEGUE EL ARCHIVO COMPLETO DEL ESQUELETO]

CRITERIOS DE ACEPTACIÓN QUE DEBE CUMPLIR:
[pegue los CA del checklist de la tarjeta, textuales]

RESTRICCIONES:
- No cambies las firmas de los métodos públicos: otros módulos dependen
  de ellas.
- No agregues archivos nuevos.
- Si el archivo está en domain/: prohibido importar FastAPI, SQLAlchemy,
  pandas, openpyxl o Pydantic.
- Si está en application/: prohibido importar FastAPI.
- Las excepciones son las de app/shared/errors.py, no excepciones nuevas.

Implementa el archivo y escribe las pruebas que verifican cada CA.
Explica qué decisión tomaste en cada punto donde había alternativas.
```

Tres cosas más:

1. **Si la IA propone cambiar una firma pública, no lo acepte solo.** Avise en
   el grupo: esa firma es de la que dependen los demás.
2. **Si la IA inventa un requisito que no está en el CA, quítelo.** Las
   instrucciones del proyecto lo dicen: nunca convertir un supuesto en
   requisito. Si de verdad hace falta, es una tarjeta nueva.
3. **Entienda lo que le entregó antes de commitear.** El Code Walkthrough vale
   15 % y el docente escoge al azar quién explica, pide justificar el código
   apoyado en IA y exige una modificación en vivo. Código que funciona pero no
   entiende es una nota perdida.

---

## 8. Preparación del Code Walkthrough

No lo dejen para el final. Cada quien debe poder responder sobre **su** módulo:

- ¿Por qué el dominio no importa SQLAlchemy? — Demuéstrelo rompiendo la regla a
  propósito y viendo fallar `test_arquitectura.py`. Es la mejor demostración
  posible y toma 30 segundos.
- ¿Por qué los códigos son texto y no números? — Los cuatro que empiezan en
  cero. Muéstrelos en el Excel real.
- ¿Por qué la matriz filtra `ultimo_nivel = true`? — Los 111 subtotales que
  duplicarían el dinero.
- ¿Por qué la matriz no es una tabla? — Es una consulta al vuelo; materializarla
  es un cambio de diseño a discutir.

Y practiquen **una modificación menor en vivo**: agregar una columna a la
matriz, o un criterio de validación al lector del PDT.

---

## 9. Documentos de referencia

| Documento              | Para qué                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| `docs/DATOS.md`        | Anatomía medida de los tres Excel. **Léalo antes de tocar un lector.** |
| `docs/DECISIONES.md`   | Decisiones de diseño con su evidencia y las que faltan ratificar       |
| `docs/ARQUITECTURA.md` | Capas, módulos, patrones y por qué                                     |
| `docs/TRAZABILIDAD.md` | Tabla HU → CA → código → prueba. **Se llena a medida que avanzan**     |
| `docs/SEGURIDAD.md`    | Checklist OWASP a completar                                            |
| `docs/BITACORA-IA.md`  | Registro obligatorio de uso de IA                                      |
| `INSTALACION.md`       | Puesta en marcha paso a paso                                           |
| `CONTRIBUTING.md`      | Ramas, commits, PR, reglas de arquitectura                             |
