# [E04-HU01] Consultar Plan de Acción Consolidado

**Estado de la Specification:** Borrador

> Mientras esté en `Borrador`, la fuente de requisitos de esta HU es su hoja
> del Excel (`docs/requisitos/`, hoja `HU_E04_01`).

## Origen

Hoja `HU_E04_01` del Excel de levantamiento de requisitos
(`GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`).

## Historia

Como administradora y alcalde quiero consultar el Plan de Acción consolidado
con la trazabilidad de metas, rubros, contratos y proyectos para revisar
seguimiento sin reconstruir cruces manuales.

## Alcance

- **Incluye:** una tabla consolidada, UNA FILA POR META (nunca por
  meta×rubro×contrato), del corte REGISTRADO más reciente.
- **Fuera de alcance:** edición de cualquier dato (CA04); paginación (no la
  pide ningún CA, volumen esperado ~144 metas/corte); autocompletado aparte
  (mismo criterio que HU-10).

## Actores y permisos

- `administrador`, `visitante`: acceso.
- `gestor`: SIN acceso — `[VALIDAR]` (ver D26 en `docs/DECISIONES.md`, punto
  4: decisión técnica propuesta, pendiente de ratificar con el equipo).
- Cualquier otro rol (p. ej. un futuro "Supervisor", CA10): denegado.

## Criterios de aceptación

| ID            | Escenario                                  | Notas |
| ------------- | ------------------------------------------- | ----- |
| E04-HU01-CA01 | Corte REGISTRADO más reciente por defecto, con vigencia/fecha en encabezado | |
| E04-HU01-CA02 | 14 columnas: Sector, Código meta, Meta, Indicador, Producto, Meta programada (PDT), BPIN, Rubro, Presupuesto definitivo, Ejecución, Contrato(s), % Avance físico, % Avance financiero, Estado de cruce | `[VALIDAR]` lista/orden con la Administradora; "Meta"/"Indicador"/"Producto" se exponen como un único `nombre_producto` — ver D26 punto 5 |
| E04-HU01-CA03 | Trazabilidad por meta expandible, sin duplicar valores en los totales | Implementado vía `agregar_por_meta` — ver D26 punto 2 |
| E04-HU01-CA04 | Solo lectura para ambos roles | Sin verbos de escritura en el router |
| E04-HU01-CA05 | Resumen "Total / Completo / Parcial / Sin información" por meta | Ver D26 punto 3 |
| E04-HU01-CA06 | Resaltar celdas vacías con leyenda | Backend: campos `None` explícitos; el resaltado visual es frontend |
| E04-HU01-CA07 | Scroll horizontal + columnas fijas | 100% frontend, sin contraparte de backend |
| E04-HU01-CA08 | Formato de cifras + exactitud contra un Excel "golden" | No existe ese dataset de referencia en el repo — `[VALIDAR]` |
| E04-HU01-CA09 | Estado vacío si no hay cortes finalizados | 404 (`recurso_no_encontrado`) — el frontend decide el texto |
| E04-HU01-CA10 | Rol "Supervisor" denegado | Ver Actores y permisos |

## Reglas de negocio

- "Ejecución" = `obligacion_acumulada` (D26 punto 1, `docs/DATOS.md` línea 65).
- Agregación sin duplicar dinero: deduplicar por `codigo_rubro_nivel` antes
  de sumar (D26 punto 2).
- Estado de cruce por meta: texto literal de CA05 (D26 punto 3).

## Datos involucrados

Mismas 4 fuentes de HU-07 (ver [docs/DATOS.md](../DATOS.md)): `MetaORM`,
`RubroORM` (`ultimo_nivel=true`, mismo filtro de sector CCPET),
`ProyectoORM`/`ProyectoIndicadorORM`, `ContratoORM` (tipo de gasto
INVERSIÓN), `RegistroPresupuestalORM` como puente.

## Contrato

- `GET /api/v1/plan-accion/actual` — autenticación/permisos:
  `administrador` o `visitante`.

## Estados y errores

| Código HTTP | `codigo` | Cuándo |
| ----------- | -------- | ------ |
| 401 | `credenciales_invalidas` | Sin token |
| 403 | `permiso_insuficiente` | Rol distinto de `administrador`/`visitante` |
| 404 | `recurso_no_encontrado` | Ningún corte REGISTRADO (CA09) |
| 409 | `operacion_no_permitida` | Al corte más reciente le falta alguna de las 3 fuentes |

## Decisiones aplicadas

- Ver [D26](../DECISIONES.md) para "Ejecución", agregación por meta, estado
  de cruce por meta y restricción de rol — las cuatro, pendientes de
  ratificar.
