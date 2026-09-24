# Anatomía de los archivos reales de Santa Rosa (Cauca)

> Referenciado desde `_comun.py`, `pdt.py`, `ejecucion.py` y `proyectos.py` como
> "ver docs/DATOS.md" — no existía como archivo hasta 2026-09-23 (D22,
> `docs/DECISIONES.md`). Este documento consolida lo medido contra los
> archivos reales del municipio y, columna por columna, qué se extrae hoy en
> el código, qué se persiste, y qué se muestra en la matriz de relación
> (HU-07). No es la fuente del dato real del municipio — es el registro de lo
> que el equipo ya confirmó sobre esos archivos.

---

## 1. Plan Indicativo (PDT)

**Origen:** SisPT. **Pestaña con metas:** `Plan indicativo - Productos` (de 6
pestañas totales; las otras 5 — `Líneas estratégicas`, `Indicadores de
resultado`, `Plan indicativo SGR - Productos`, `Iniciativas SGR`,
`Iniciativas PATR` — no se interpretan). **Encabezado en la fila 2** (una fila
de título de sección, `PARTE ESTRATÉGICA`, va encima). **86 columnas, 144
filas de metas** en el corte de referencia (D4, `docs/DECISIONES.md`).

| Columna real                                                       | ¿Se extrae?                    | Campo (`meta`/lector)                                     | Notas                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Código de indicador de producto (MGA)                              | ✅ Obligatoria                 | `cod_indicador_producto`                                  | La llave del cruce de HU-07 (9 dígitos, texto)                                                                                                                                                                     |
| Código de indicador de producto (SisPT)                            | ✅ Opcional (desde 2026-09-23) | `cod_indicador_sistp`                                     | **NO es llave de cruce** — contiene "IP-63", intersección con CCPET es CERO (medido, ver `shared/codigos.py`). Solo diagnóstico                                                                                    |
| Producto (MGA)                                                     | ✅ Opcional                    | `nombre_producto`                                         |                                                                                                                                                                                                                    |
| Indicador de Producto(MGA)                                         | ✅ Opcional                    | `unidad_medida`                                           | **Confirmado 2026-09-23, no cambiar:** en el archivo real esta columna trae la unidad de medida ("Kilómetros", "Número"), no un indicador — indicador y unidad de medida son el mismo dato en este archivo         |
| Principal                                                          | ✅ Obligatoria                 | `principal`/`es_principal`                                | Sí/No — filas no reconocibles se descartan                                                                                                                                                                         |
| Programación del producto bien o servicio `<vigencia>`             | ✅ Obligatoria                 | `meta_cuatrienio`                                         | Nombre de columna depende de la vigencia del corte                                                                                                                                                                 |
| Total `<vigencia>`                                                 | ❌ No se extrae                | —                                                         | Mencionada como "columna que importa" en el docstring original de `pdt.py`, nunca implementada. Pendiente de decidir si hace falta                                                                                 |
| Entidad Territorial                                                | ✅ Opcional (desde 2026-09-23) | `entidad_territorial`                                     | Metadato del plan — mismo valor repetido en las 144 filas                                                                                                                                                          |
| Nombre del Plan                                                    | ✅ Opcional (desde 2026-09-23) | `nombre_plan`                                             | ídem                                                                                                                                                                                                               |
| Fecha de creación del plan                                         | ✅ Opcional (desde 2026-09-23) | `fecha_creacion_plan`                                     | ídem, parseada con `_comun.fecha`                                                                                                                                                                                  |
| Línea estratégica                                                  | ✅ Opcional (desde 2026-09-23) | `linea_estrategica`                                       | Propia de cada meta (jerarquía MGA)                                                                                                                                                                                |
| Código del sector (MGA) / Sector (MGA)                             | ✅ Opcional (desde 2026-09-23) | `codigo_sector`/`sector`                                  |                                                                                                                                                                                                                    |
| Código del programa (MGA) / Programa (MGA)                         | ✅ Opcional (desde 2026-09-23) | `codigo_programa`/`programa`                              |                                                                                                                                                                                                                    |
| Código ODS / ODS                                                   | ✅ Opcional (desde 2026-09-23) | `codigo_ods`/`ods`                                        |                                                                                                                                                                                                                    |
| Tipo de acumulación                                                | ✅ Opcional (desde 2026-09-23) | `tipo_acumulacion`                                        |                                                                                                                                                                                                                    |
| Código de producto (MGA)                                           | ✅ Opcional (desde 2026-09-23) | `codigo_producto_mga`                                     | **SUPUESTO sin confirmar** — el nombre exacto de esta columna en el archivo real de Santa Rosa no se ha verificado todavía; se asume por convención de la jerarquía MGA (Sector → Programa → Producto → Indicador) |
| (BPIN relacionado, si existe)                                      | ❌ No se extrae                | `bpin_relacionados` (columna de BD ya existe, sin poblar) | El comentario original de `models.py` anticipa un BPIN multivaluado en el PDT, pero ningún nombre de columna real está confirmado — pendiente de verificar contra el archivo real antes de intentar extraerlo      |
| Código del sector (MGA), programa, etc. (resto de las 86 columnas) | ❌ No se extrae                | —                                                         | Fuera de alcance de HU-02; no hay CA que las pida                                                                                                                                                                  |

---

## 2. Archivo presupuestal (Ejecución + Contratación)

**Un archivo, dos pestañas, procesadas independientemente.** La pestaña de
ejecución se llama `Formato Resumido Ejecucion Gast` en el archivo real
(Excel trunca a 31 caracteres), no `EJECUCION`. La de contratación sí es
`CONTRATACION`.

### 2.1 Pestaña Ejecución — 485 filas en el corte de referencia

| Columna real                                                                                            | ¿Se extrae?                                    | Campo (`rubro`)                                                                                                        | Notas                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CodigoRubroNivel                                                                                        | ✅ Obligatoria                                 | `codigo_rubro_nivel`                                                                                                   | La llave utilizable del rubro (484 únicos de 485 — 1 duplicado)                                                                                                                           |
| UltimoNivel                                                                                             | ✅ Obligatoria, **y filtrada**                 | `ultimo_nivel`                                                                                                         | 374 hojas / 111 subtotales. **Regla 1 (`consultas.py`): solo `ultimo_nivel = true` participa del cruce** — un subtotal ya incluye el valor de sus hojas                                   |
| CodigoRubroCcpet                                                                                        | ✅ Opcional                                    | `codigo_rubro_ccpet`                                                                                                   | 343 únicos de 485 (142 duplicados) — NO sirve como llave                                                                                                                                  |
| CodigoSectorCcpet                                                                                       | ✅ Opcional, **y filtrada** (desde 2026-09-23) | `codigo_sector_ccpet`                                                                                                  | **Regla 1b: un rubro con sector vacío o "NA" no participa del cruce** (a pedido explícito del equipo, D22)                                                                                |
| NombreSectorCcpet                                                                                       | ✅ Opcional (desde 2026-09-23)                 | `nombre_sector_ccpet`                                                                                                  | Antes solo se guardaba el código, nunca el nombre                                                                                                                                         |
| CodigoIndicadorCcpet                                                                                    | ✅ Obligatoria                                 | `cod_indicador_producto`                                                                                               | Llave de cruce con el PDT (119 de 120 coinciden — D4)                                                                                                                                     |
| CodigoTipoGasto                                                                                         | ✅ Opcional                                    | `codigo_tipo_gasto`                                                                                                    | Código de tipo de gasto DEL RUBRO — distinto de `Tipo Gasto` de Contratación (ver 2.2); ninguno de los dos tiene regla de filtro sobre este campo del rubro                               |
| NombreFuenteFinanciacionCcpet                                                                           | ✅ Opcional                                    | `nombre_financiacion`                                                                                                  |                                                                                                                                                                                           |
| CodigoProductoCcpet                                                                                     | ✅ Opcional                                    | `codigo_producto_ccpet`                                                                                                |                                                                                                                                                                                           |
| ApropiacionDefinitiva, DisponibilidadAcumulada, Compromiso Acumulado, OrdenPagoAcumulado, PagoAcumulado | ✅ Opcionales                                  | `apropiacion_definitiva`, `disponibilidad_acumulada`, `compromiso_acumulado`, `obligacion_acumulada`, `pago_acumulado` | Montos, parseados con `_comun.numero` (formato colombiano). `apropiacion_definitiva` es la única que llega a la matriz de HU-07 (`presupuesto_apropiado`, un solo monto general — ver §4) |
| CodigoBpin                                                                                              | ✅ (poblado en solo 3 de 485 filas)            | —                                                                                                                      | El BPIN confiable de esta pestaña NO está aquí — viene de Contratación                                                                                                                    |

### 2.2 Pestaña Contratación — 319 filas / 270 contratos únicos

| Columna real                                                                           | ¿Se extrae?                                    | Campo (`contrato`/`registro_presupuestal`)        | Notas                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NumeroContrato                                                                         | ✅ Obligatoria                                 | `numero_contrato`                                 | NO es llave única (CT2) — `llave_sustituta` queda NULL, ver `ejecucion.py`                                                                                             |
| Cod Indicador Ccpet                                                                    | ✅ Opcional                                    | `cod_indicador_producto` (en `contrato`)          | Mismo dato que `CodigoIndicadorCcpet` de Ejecución (HU-03/CA-3)                                                                                                        |
| Tipo Gasto                                                                             | ✅ Opcional, **y filtrada** (desde 2026-09-23) | `tipo_gasto`                                      | **Regla 1c: solo contratos con Tipo Gasto = INVERSIÓN participan del cruce** (a pedido explícito del equipo, D22). Se acepta con o sin tilde ("INVERSION"/"INVERSIÓN") |
| Codigo Bpin / CodigoBpin                                                               | ✅ Opcional (poblado en 200 de 319, 63%)       | `bpin`                                            | **Este es el BPIN confiable** — un tercio de los contratos no cruza por diseño de los datos de origen, no es un defecto                                                |
| Objeto                                                                                 | ✅ Opcional                                    | `objeto` / `descripcion_contrato` (en la matriz)  |                                                                                                                                                                        |
| Modalidad seleccion                                                                    | ✅ Opcional                                    | `modalidad_seleccion`                             |                                                                                                                                                                        |
| Nit/Nombre Contratista                                                                 | ✅ Opcionales                                  | `nit_contratista`/`nombre_contratista`            |                                                                                                                                                                        |
| Valor Contrato / Pagos                                                                 | ✅ Opcionales                                  | `valor_contrato`/`valor_pagado`                   | `valor_pagado` sale de "Pagos" (a nivel de contrato, no hay desglose por CDP)                                                                                          |
| CodigoRubro                                                                            | ✅ Opcional                                    | `codigo_rubro_crudo` (en `registro_presupuestal`) | Coincide 100% con `CodigoRubroNivel` de Ejecución                                                                                                                      |
| Numero CDP, Fecha CDP, Valor CDP, Numero Registro, Fecha Registro, Valor Registro Ptal | ✅ Opcionales                                  | campos de `registro_presupuestal`                 | Una fila = un CDP/registro contra un contrato (1..N por contrato)                                                                                                      |

**Sobre "el archivo BPIN":** en este sistema NO existe un cuarto archivo
separado llamado BPIN. Hay dos fuentes de BPIN:

1. La columna `Codigo Bpin`/`CodigoBpin` de Contratación (esta sección).
2. La **plantilla de proyectos BPIN** (§3) — el tercer archivo que se sube en
   el wizard (`TipoArchivo.PROYECTOS`), donde BPIN es la clave principal.

---

## 3. Plantilla de proyectos BPIN

**1 pestaña nombrada con el año** (sin convención fija — se busca por
contenido, no por nombre). **134 filas, 48 columnas, 221 rangos de celdas
combinadas verticalmente** (una fila de proyecto seguida de filas que solo
traen datos de contrato). **38 proyectos reales** entre las 134 filas. Uno de
los 38 BPIN no cumple el formato de 15 dígitos — se conserva sin normalizar
(HU-04/CA-2, "tal cual").

Este lector es **deliberadamente más permisivo** que los otros dos (HU-04/CA-2
y CA-3): solo se extraen las columnas necesarias, sin validar ni extraer el
resto.

| Columna real                                                       | ¿Se extrae?     | Campo (`proyecto`)                           | Notas                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Código BPIN                                                        | ✅ Obligatoria  | `bpin`                                       | Clave principal — sin pasar por normalización (uno de los 38 no cumple 15 dígitos)                                                                                                                                                                     |
| Nombre del proyecto                                                | ✅ Opcional     | `nombre_proyecto`                            |                                                                                                                                                                                                                                                        |
| Indicador de producto                                              | ✅ Obligatoria  | `indicador_producto_raw`/`codigos_indicador` | **Multivalor dentro de una celda** (código + nombre + monto separados por salto de línea) — `CodigoIndicadorProducto.extraer_todos` separa por coma/punto y coma/guion/espacio/salto de línea (D13, D14). 67 códigos únicos, todos presentes en el PDT |
| (resto de las 48 columnas: datos de contrato de la fila combinada) | ❌ No se extrae | —                                            | Fuera de alcance (HU-04/CA-3: "sin validar el resto"). El contrato de esa fila se persiste por separado vía Contratación (§2.2), cruzando por BPIN/rubro                                                                                               |

---

## 4. Qué llega a la matriz de relación (HU-07)

La matriz (`trazabilidad/persistence/consultas.py::construir_matriz`) expone
**siete columnas**, sin importar cuántas se persistan arriba:

```
cod_indicador_producto, nombre_producto, cod_bpin, cod_indicador_ejecucion,
numero_contrato, descripcion_contrato, presupuesto_apropiado
```

`presupuesto_apropiado` (agregada 2026-09-23, D22) es la `apropiacion_definitiva`
del rubro cruzado — un solo monto general, no las cinco columnas financieras
de `Rubro`. Es deliberadamente así: la matriz es para verificar visualmente
que el cruce se hizo bien (¿esta meta tiene proyecto, ejecución y contrato?),
no un reporte financiero detallado — para eso están las tablas `rubro`/
`contrato`/`registro_presupuestal` directamente.

### 4.1 Reglas de negocio que participan del cruce (todas dentro del JOIN, nunca en un WHERE posterior — ver docstring de `_construir_consulta_base`)

1. `RubroORM.ultimo_nivel = true` (subtotales excluidos).
2. `RubroORM.codigo_sector_ccpet` no vacío ni "NA" (agregada 2026-09-23).
3. `ContratoORM.tipo_gasto` = INVERSIÓN, con o sin tilde (agregada 2026-09-23).

### 4.2 Filtros de la matriz (agregados 2026-09-23, D22)

- `estado_cruce`: `completo` / `sin_proyecto` / `sin_ejecucion` / `sin_contrato`
  / `sin_cruce` — sobre las mismas tres correspondencias del punto anterior.
- `busqueda`: texto libre sobre código de indicador, BPIN o número de contrato.

Ver `docs/DECISIONES.md` D22 para el resto de filtros propuestos (por sector,
por rango de presupuesto) que quedaron definidos pero sin implementar.

---

## 5. Preguntas abiertas (sin confirmar contra el archivo real)

- **`codigo_producto_mga`** (PDT): nombre de columna asumido ("Código de
  producto (MGA)"), no verificado.
- **`bpin_relacionados`** (PDT): ningún nombre de columna real identificado
  todavía — la columna existe en `MetaORM` desde el esquema inicial, sigue
  sin poblarse.
- **"Total `<vigencia>`"** (PDT): mencionada en la anatomía original del
  archivo como columna relevante, nunca extraída — pendiente de decidir si
  hace falta para algo.
