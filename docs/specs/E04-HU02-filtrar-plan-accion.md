# [E04-HU02] Filtrar el Plan de Acción Consolidado

**Estado de la Specification:** Borrador

> Mientras esté en `Borrador`, la fuente de requisitos de esta HU es su hoja
> del Excel (`docs/requisitos/`, hoja `HU_E04_02`).

## Origen

Hoja `HU_E04_02` del Excel de levantamiento de requisitos
(`GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`).

## Historia

Como administradora y alcalde quiero filtrar el Plan de Acción por criterios
como sector, indicador, meta o estado de cruce para encontrar rápidamente la
información necesaria.

## Alcance

- **Incluye:** filtrar el resultado de [E04-HU01] por sector, estado de
  cruce y búsqueda de texto de meta (código o nombre).
- **Fuera de alcance:** un filtro "Indicador" separado de "Meta" — ver D27
  en `docs/DECISIONES.md`.

## Actores y permisos

Mismos que E04-HU01 (D26): `administrador` y `visitante`.

## Criterios de aceptación

| ID            | Escenario                                                               | Notas                                                             |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| E04-HU02-CA01 | Panel de filtros: Sector, Indicador, Meta, Estado de cruce              | Ver D27 — "Indicador" no tiene criterio propio distinto de "Meta" |
| E04-HU02-CA02 | Filtrar por sector                                                      | `sector` (lista, exacta)                                          |
| E04-HU02-CA03 | Filtrar por estado de cruce                                             | `estado_cruce` (lista), valores de `EstadoCruceMeta` (HU01-CA05)  |
| E04-HU02-CA04 | Buscar meta por texto (código o nombre, ≥3 car., sin tildes/mayúsculas) | `busqueda` — normalización vía `unicodedata`/`casefold`           |
| E04-HU02-CA05 | Combinación: AND entre criterios, OR dentro de uno mismo                | Mismo criterio que HU-10 de `trazabilidad`                        |
| E04-HU02-CA06 | Resumen recalculado sobre filas filtradas                               | `calcular_resumen` se llama DESPUÉS de filtrar                    |
| E04-HU02-CA07 | Estado vacío si ningún resultado                                        | 200 con `filas: []`, mensaje es responsabilidad del frontend      |
| E04-HU02-CA08 | Limpiar filtros                                                         | Omitir los 3 query params devuelve todo                           |

## Reglas de negocio

- Filtrado en memoria sobre filas ya agregadas por meta, no en SQL — ver
  D27 en `docs/DECISIONES.md` para el motivo (estado_cruce es Python, no
  columna de BD).

## Contrato

- `GET /api/v1/plan-accion/actual` (extiende E04-HU01) — nuevos query
  params: `sector` (repetible), `estado_cruce` (repetible), `busqueda`
  (texto). Mismo contrato de autenticación/errores que E04-HU01.

## Decisiones aplicadas

- Ver [D27](../DECISIONES.md) para el alcance de "Indicador" vs "Meta" y
  la decisión de filtrar en memoria, no en SQL.
