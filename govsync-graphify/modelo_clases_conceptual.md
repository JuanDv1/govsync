# Modelo de Clases Conceptual — GovSync

Sistema de seguimiento a planes de desarrollo territorial. El modelo se organiza en dos grandes categorías: **clases de dominio** (con estado, atributos persistentes y ciclo de vida propio) y **clases de servicio** (sin estado, encapsulan lógica de negocio transversal). Dentro de las clases de dominio, se agrupan en cuatro ejes temáticos.

---

## 1. Clases de Dominio (Con Estado)

### Eje de Gobernanza y Acceso

#### Usuario

- **Atributos**: `nombre` (str), `email` (str), `rol` (enum: ADMIN, SUPERVISOR, ALCALDE), `activo` (bool)
- **Métodos**: `autenticar(pwd): Token`, `tieneAccesoASector(s)`
- **Relaciones**: Reporta `AvanceFisico` (1 a 0.._) · Administra `Municipio` (1 a 0.._)
- **Rol en el sistema**: representa a los actores que acceden al sistema y controla permisos por sector.

#### Municipio

- **Atributos**: `codigoDane` (str(5)), `nombre` (str), `categoria` (int)
- **Relaciones**: Formula `PlanDesarrollo` (1 a 0.._) · Tiene `Corte` (1 a 0.._)
- **Ejemplo**: Santa Rosa, Cauca — código DANE 19701.

---

### Eje de Planeación Territorial (Estructura MGA y SisPT)

#### PlanDesarrollo

- **Atributos**: `nombre` (str), `vigenciaInicio` (int), `vigenciaFin` (int)
- **Relaciones**: Tiene `MetaPlan` (1 a 1.._) · Tiene `CargaArchivo` (1 a 0.._) · Tiene `LineaEstrategica` (1 a 1..*)
- **Descripción**: plan político-administrativo cuatrienal municipal.

#### LineaEstrategica

- **Descripción**: subdivisión de alto nivel del plan de desarrollo; agrupa sectores o programas bajo un objetivo estratégico común.
- **Relaciones**: Pertenece a `PlanDesarrollo` (0..* a 1)

#### Sector

- **Atributos**: `codigo` (str(2)), `nombre` (str)
- **Relaciones**: Tiene `Programa` (1 a 1..*)
- **Descripción**: clasificación sectorial del gasto público.

#### Programa

- **Atributos**: `codigo` (str(4)), `nombre` (str)
- **Relaciones**: Tiene `Producto` (1 a 1..*)
- **Descripción**: nivel intermedio de la estructura del gasto.

#### Producto

- **Atributos**: `codigo` (str(7)), `nombre` (str)
- **Relaciones**: Tiene `IndicadorProducto` (1 a 1)
- **Descripción**: bien o servicio entregado por la administración.

#### IndicadorProducto

- **Atributos**: `codigo` (str(9)), `nombre` (str), `unidadMedida` (str)
- **Métodos**: `obtenerMatrizRelacion()`
- **Relaciones**: Tiene `MetaPlan` (1 a 0..*)
- **Descripción**: unidad de medida para cuantificar el avance del producto.

#### MetaPlan

- **Atributos**: `consecutivoSisPT` (str), `metaCuatrenio` (Decimal), `progFisica` (Decimal), `progFinanciera` (Decimal), `esPrincipal` (bool)
- **Métodos**: `estaProgramada(): bool`, `obtenerTrazabilidad(): PlanAccionMeta`
- **Relaciones**: Tiene `ProgramacionFuente` (1 a 0.._) · Tiene `AvanceFisico` (1 a 0.._) · Financia `Rubro` (1 a 0..*)
- **Descripción**: meta física y financiera del plan indicativo del SisPT.

#### ProgramacionFuente

- **Descripción**: clase de asociación entre `MetaPlan` y `FuenteFinanciacion`; detalla el valor financiero programado para una meta específica por cada fuente de financiación.
- **Relaciones**: Pertenece a `MetaPlan` (0..* a 1) · Referencia `FuenteFinanciacion` (0..* a 1)

#### FuenteFinanciacion

- **Atributos**: `codigo` (str), `nombre` (str)
- **Descripción**: catálogo de fuentes públicas que financian tanto la programación del SisPT (vía `ProgramacionFuente`) como la ejecución de los rubros presupuestales.

---

### Eje de Ejecución Presupuestal y Contractual

#### Rubro

- **Atributos**: `codigoRubroNivel` (str), `apropiacionDefinitiva` (Decimal), `compromisoAcum` (Decimal), `obligacionAcum` (Decimal), `pagoAcum` (Decimal)
- **Métodos**: `extraerCodigoIndicador(): str`
- **Relaciones**: Tiene `LineaContrato` (1 a 0..*)
- **Descripción**: registro de ejecución presupuestal proveniente del software local o de CUIPO.

#### Contrato

- **Atributos**: `numeroContrato` (str), `nitContratista` (str), `objeto` (str)
- **Métodos**: `generarLlaveSustituta(): str`
- **Relaciones**: Fracciona `LineaContrato` (1 a 1..*)
- **Descripción**: objeto contractual de inversión pública municipal.

#### LineaContrato

- **Atributos**: `numeroCdp` (str), `valorRp` (Decimal), `valorPagos` (Decimal)
- **Descripción**: representa la afectación presupuestal de un contrato específico.

#### ProyectoBpin

- **Atributos**: `codigoBpin` (str(15)), `nombreProyecto` (str)
- **Métodos**: `obtenerIndicadores(): List<IndicadorProducto>`
- **Descripción**: proyecto de inversión registrado en la Plataforma Integrada de Inversión Pública (PIIP).

---

### Eje de Seguimiento, Cortes y Evidencia

#### Corte

- **Atributos**: `vigencia` (int), `fechaCorte` (date), `version` (int)
- **Métodos**: `admiteEscritura(): bool`, `obtenerHistorico(): List<Corte>`
- **Relaciones**: Produce `ResultadoCruce` (1 a 0.._) · Tiene `CargaArchivo` (1 a 1.._)
- **Descripción**: snapshot o captura temporal de la información del territorio en un momento de seguimiento.

#### CargaArchivo

- **Atributos**: `tipoFuente` (enum), `nombreArchivo` (str), `contenido` (bytes), `estado` (enum), `vigente` (bool)
- **Métodos**: `modificarUltima(f): CargaArchivo`, `reemplazarEnCreacion(f): CargaArchivo`
- **Relaciones**: Tiene `ProyectoBpin` (1 a 0.._) · Tiene `Contrato` (1 a 0.._)
- **Descripción**: registro de la ingesta y validación de archivos Excel cargados.

#### AvanceFisico

- **Atributos**: `vigencia` (int), `fechaCorte` (date), `cantidad` (Decimal), `observacion` (str), `origen` (enum)
- **Métodos**: `registrar(cant, obs): AvanceFisico`, `corregir(cant, obs): AvanceFisico`
- **Descripción**: reporte de ejecución física de una meta, ingresado por el supervisor sectorial.

#### ResultadoCruce

- **Atributos**: `estado` (enum), `apropiacionPago` (Decimal), `pctAvanceFinanciero` (Decimal), `pctAvanceFisico` (Decimal), `semaforo` (enum)
- **Métodos**: `obtenerMatrizRelacion(c): List<FilaRelacion>`, `compararCortes(c1,c2): List<ComparacionMeta>`, `avanceFinancieroMenorA(pct): List<ResultadoCruce>`
- **Relaciones**: Genera `Alerta` (1 a 0..*)
- **Descripción**: matriz consolidada de seguimiento que almacena los indicadores de avance calculados y la semaforización correspondiente.

#### Alerta

- **Atributos**: `tipo` (enum), `descripcion` (str), `magnitud` (Decimal)
- **Métodos**: `listarSinTrazabilidad(c): List<Alerta>`, `listarInconsistenciasFinancieras(c): List<Alerta>`
- **Descripción**: inconsistencia financiera o física detectada de forma automática por el sistema.

---

## 2. Clases de Servicio (Sin Estado)

Componentes especializados en encapsular lógica de negocio compleja, transformaciones de datos y cálculos globales que no corresponden a una sola entidad persistente.

#### GeneradorPlanAccion

- **Métodos**: `consultar(c.filtroSector): PlanAccion`, `filtrar(criterios): PlanAccion`, `exportarExcel(c): bytes`
- **Relaciones**: Genera `ResultadoCruce` (1 a 1) · Tiene `PlanDesarrollo` (1 a 1)
- **Descripción**: servicio para la consulta, filtrado multicriterio y exportación a Excel del plan de acción consolidado.

#### ValidadorCargas / SanitizadorExcel

- **Descripción**: servicios que realizan la inspección estructural de columnas obligatorias y la limpieza de datos cargados en `CargaArchivo`.

#### MotorCruce

- **Descripción**: orquestador de la lógica de conciliación relacional entre BPIN (`ProyectoBpin`), SisPT (`MetaPlan`), `Rubro` y `Contrato`; produce los `ResultadoCruce`.

#### CalculadoraIndicadores / GeneradorAlertas

- **Descripción**: servicios encargados de evaluar las reglas financieras y de avance físico para generar las `Alerta` de inconsistencias.

---

## Resumen de relaciones clave (para extracción de grafo)

| Origen                                  | Relación        | Destino                                 | Cardinalidad |
| --------------------------------------- | --------------- | --------------------------------------- | ------------ |
| Usuario                                 | reporta         | AvanceFisico                            | 1 a 0..*     |
| Usuario                                 | administra      | Municipio                               | 1 a 0..*     |
| Municipio                               | formula         | PlanDesarrollo                          | 1 a 0..*     |
| Municipio                               | tiene           | Corte                                   | 1 a 0..*     |
| PlanDesarrollo                          | tiene           | LineaEstrategica                        | 1 a 1..*     |
| PlanDesarrollo                          | tiene           | MetaPlan                                | 1 a 1..*     |
| PlanDesarrollo                          | tiene           | CargaArchivo                            | 1 a 0..*     |
| Sector                                  | tiene           | Programa                                | 1 a 1..*     |
| Programa                                | tiene           | Producto                                | 1 a 1..*     |
| Producto                                | tiene           | IndicadorProducto                       | 1 a 1        |
| IndicadorProducto                       | tiene           | MetaPlan                                | 1 a 0..*     |
| MetaPlan                                | tiene           | ProgramacionFuente                      | 1 a 0..*     |
| ProgramacionFuente                      | referencia      | FuenteFinanciacion                      | 0..* a 1     |
| MetaPlan                                | tiene           | AvanceFisico                            | 1 a 0..*     |
| MetaPlan                                | financia        | Rubro                                   | 1 a 0..*     |
| Rubro                                   | tiene           | LineaContrato                           | 1 a 0..*     |
| Contrato                                | fracciona       | LineaContrato                           | 1 a 1..*     |
| CargaArchivo                            | tiene           | ProyectoBpin                            | 1 a 0..*     |
| CargaArchivo                            | tiene           | Contrato                                | 1 a 0..*     |
| Corte                                   | produce         | ResultadoCruce                          | 1 a 0..*     |
| Corte                                   | tiene           | CargaArchivo                            | 1 a 1..*     |
| ResultadoCruce                          | genera          | Alerta                                  | 1 a 0..*     |
| GeneradorPlanAccion                     | genera          | ResultadoCruce                          | 1 a 1        |
| GeneradorPlanAccion                     | tiene           | PlanDesarrollo                          | 1 a 1        |
| MotorCruce                              | orquesta        | ProyectoBpin, MetaPlan, Rubro, Contrato | —            |
| CalculadoraIndicadores/GeneradorAlertas | evalúa → genera | Alerta                                  | —            |
| ValidadorCargas/SanitizadorExcel        | valida/limpia   | CargaArchivo                            | —            |
