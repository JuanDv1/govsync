# Modelo Entidad-Relación

Este documento describe el modelo entidad-relación basado en el diagrama proporcionado [cite: 3].

## Entidades y Atributos

### 1. corte

| Atributo         | Tipo      | Descripción                   |
| ---------------- | --------- | ----------------------------- |
| `id`             | uuid      | Clave primaria (PK) [cite: 3] |
| `vigencia`       | date      | [cite: 3]                     |
| `fecha_creacion` | timestamp | [cite: 3]                     |

### 2. archivo_fuente

| Atributo          | Tipo      | Descripción                            |
| ----------------- | --------- | -------------------------------------- |
| `id`              | uuid      | Clave primaria (PK) [cite: 3]          |
| `corte_id`        | uuid      | Clave foránea (FK) a `corte` [cite: 3] |
| `tipo`            | varchar   | [cite: 3]                              |
| `reutilizado`     | boolean   | [cite: 3]                              |
| `corte_origen_id` | uuid      | [cite: 3]                              |
| `nombre_archivo`  | varchar   | [cite: 3]                              |
| `fecha_carga`     | timestamp | [cite: 3]                              |

### 3. meta

| Atributo              | Tipo    | Descripción                            |
| --------------------- | ------- | -------------------------------------- |
| `id`                  | uuid    | Clave primaria (PK) [cite: 3]          |
| `corte_id`            | uuid    | Clave foránea (FK) a `corte` [cite: 3] |
| `cod_sistp`           | varchar | [cite: 3]                              |
| `cod_mga`             | varchar | [cite: 3]                              |
| `codigo_producto_mga` | varchar | [cite: 3]                              |
| `nombre_producto`     | varchar | [cite: 3]                              |
| `unidad_medida`       | varchar | [cite: 3]                              |
| `meta_cuatrenio`      | numeric | [cite: 3]                              |
| `bpin_relacionados`   | text    | [cite: 3]                              |

### 4. meta_programacion_fisica

| Atributo           | Tipo    | Descripción                           |
| ------------------ | ------- | ------------------------------------- |
| `id`               | uuid    | Clave primaria (PK) [cite: 3]         |
| `meta_id`          | uuid    | Clave foránea (FK) a `meta` [cite: 3] |
| `anio`             | integer | [cite: 3]                             |
| `valor_programado` | numeric | [cite: 3]                             |

### 5. proyecto

| Atributo                 | Tipo    | Descripción                            |
| ------------------------ | ------- | -------------------------------------- |
| `id`                     | uuid    | Clave primaria (PK) [cite: 3]          |
| `corte_id`               | uuid    | Clave foránea (FK) a `corte` [cite: 3] |
| `bpin`                   | varchar | [cite: 3]                              |
| `nombre_proyecto`        | varchar | [cite: 3]                              |
| `indicador_producto_raw` | text    | [cite: 3]                              |

### 6. programacion_financiera

| Atributo           | Tipo    | Descripción                               |
| ------------------ | ------- | ----------------------------------------- |
| `id`               | uuid    | Clave primaria (PK) [cite: 3]             |
| `meta_id`          | uuid    | Clave foránea (FK) a `meta` [cite: 3]     |
| `proyecto_id`      | uuid    | Clave foránea (FK) a `proyecto` [cite: 3] |
| `fuente`           | varchar | [cite: 3]                                 |
| `anio`             | integer | [cite: 3]                                 |
| `valor_programado` | numeric | [cite: 3]                                 |

### 7. rubro

| Atributo                 | Tipo    | Descripción                            |
| ------------------------ | ------- | -------------------------------------- |
| `id`                     | uuid    | Clave primaria (PK) [cite: 3]          |
| `corte_id`               | uuid    | Clave foránea (FK) a `corte` [cite: 3] |
| `codigo_rubro_completo`  | varchar | [cite: 3]                              |
| `codigo_indicador_ccpet` | varchar | [cite: 3]                              |
| `codigo_producto_ccpet`  | varchar | [cite: 3]                              |
| `nombre_financiacion`    | varchar | [cite: 3]                              |
| `ultimo_nivel`           | boolean | [cite: 3]                              |
| `codigo_tipo_gasto`      | varchar | [cite: 3]                              |
| `apropiacion_definitiva` | numeric | [cite: 3]                              |
| `compromiso_acumulado`   | numeric | [cite: 3]                              |
| `pago_acumulado`         | numeric | [cite: 3]                              |
| `saldo_disponible`       | numeric | [cite: 3]                              |

### 8. contrato

| Atributo          | Tipo    | Descripción                               |
| ----------------- | ------- | ----------------------------------------- |
| `id`              | uuid    | Clave primaria (PK) [cite: 3]             |
| `corte_id`        | uuid    | Clave foránea (FK) a `corte` [cite: 3]    |
| `proyecto_id`     | uuid    | Clave foránea (FK) a `proyecto` [cite: 3] |
| `numero_contrato` | varchar | [cite: 3]                                 |
| `objeto`          | text    | [cite: 3]                                 |
| `tipo_gasto`      | varchar | [cite: 3]                                 |
| `valor_contrato`  | numeric | [cite: 3]                                 |
| `valor_pagado`    | numeric | [cite: 3]                                 |
| `bpin`            | varchar | [cite: 3]                                 |

### 9. registro_presupuestal

| Atributo              | Tipo    | Descripción                               |
| --------------------- | ------- | ----------------------------------------- |
| `id`                  | uuid    | Clave primaria (PK) [cite: 3]             |
| `contrato_id`         | uuid    | Clave foránea (FK) a `contrato` [cite: 3] |
| `rubro_id`            | uuid    | Clave foránea (FK) a `rubro` [cite: 3]    |
| `numero_cdp`          | varchar | [cite: 3]                                 |
| `numero_registro`     | varchar | [cite: 3]                                 |
| `valor_registro_ptal` | numeric | [cite: 3]                                 |
