# [E04-HU04] Comparar dos cortes de una misma vigencia

**Estado de la Specification:** Borrador

> Mientras esté en `Borrador`, la fuente de requisitos de esta HU es su hoja
> del Excel (`docs/requisitos/`, hoja `HU_E04_04`).

## Origen

Hoja `HU_E04_04` del Excel de levantamiento de requisitos
(`GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`).

## Historia

Como administradora y alcalde quiero comparar el Plan de Acción consolidado
entre dos cortes de una misma vigencia para ver la evolución de la
ejecución y el avance de las metas en el tiempo.

## Alcance

- **Incluye (backend):** listar los cortes disponibles de una vigencia,
  comparar las filas agregadas de dos cortes elegidos (mismo tipo de
  agregación por meta que [E04-HU01], D26), calcular el delta entre
  ambos, filtrar opcionalmente a "solo cambios", y exportar la
  comparación a Excel.
- **Fuera de alcance:** la representación visual de la comparación
  (tabla, resaltado de cambios, gráficas) es 100% frontend.

## Actores y permisos

Mismos que E04-HU01/HU02/HU03 (D26): `administrador` y `visitante`.

## Criterios de aceptación

| ID            | Escenario                              | Notas                                                                                        |
| ------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| E04-HU04-CA01 | Listar cortes de una vigencia          | `GET /cortes-disponibles?vigencia=X` — solo cortes `REGISTRADO`                              |
| E04-HU04-CA02 | Menos de 2 cortes disponibles          | El endpoint no rechaza ni distingue el caso — el frontend decide deshabilitar el selector    |
| E04-HU04-CA03 | Elegir dos cortes de la misma vigencia | `GET /comparar?corte_id_1=X&corte_id_2=Y` — orden de los dos ids es indiferente, ver D29     |
| E04-HU04-CA04 | Tabla comparativa                      | Metas de ambos cortes, con valores A/B por métrica                                           |
| E04-HU04-CA05 | Cálculo de Δ (delta)                   | `Δ = Corte B − Corte A`, por ejecución y avance financiero (avance físico sin E-03)          |
| E04-HU04-CA06 | Metas presentes en un solo corte       | `presencia` = `solo_corte_a` / `solo_corte_b`, Δ = `None` (no comparable, distinto de 0)     |
| E04-HU04-CA07 | Ver solo cambios                       | `solo_cambios=true` — filtro de backend, nunca oculta metas `solo_corte_a`/`solo_corte_b`    |
| E04-HU04-CA08 | Exportar la comparación                | `GET /comparar/exportar` — mismos query params, reutiliza `persistence/exportacion_excel.py` |

## Reglas de negocio

- Comparar un corte consigo mismo, o cortes de vigencias distintas, es
  `422 regla_de_negocio_violada` (no un dato de entrada simplemente
  "raro", sino una comparación que no tiene sentido semántico).
- Comparar contra un corte en `BORRADOR` es `409 operacion_no_permitida`
  (puede seguir cambiando) — mismo código que `_verificar_fuentes_completas`.
- "Corte A" es siempre el de `fecha_corte` menor (el más antiguo); "Corte
  B" el más reciente — determinado por el sistema, no por el orden en que
  llegan `corte_id_1`/`corte_id_2` (ver D29 punto 1).
- El emparejamiento de metas usa `cod_indicador_producto`, la misma llave
  que `agregar_por_meta` (D26).

## Contrato

- `GET /api/v1/plan-accion/cortes-disponibles?vigencia=<int>` — `200` con
  lista de `{id, fecha_corte}` ordenada por `fecha_corte` ascendente.
- `GET /api/v1/plan-accion/comparar?corte_id_1=<uuid>&corte_id_2=<uuid>&solo_cambios=<bool>` —
  `200` con `{corte_a, corte_b, filas: [...]}`. Errores: `404` (corte
  inexistente), `422` (mismo corte / vigencias distintas), `409` (corte en
  `BORRADOR`).
- `GET /api/v1/plan-accion/comparar/exportar` — mismos query params que
  `/comparar`, respuesta `200` con
  `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Mismo contrato de autenticación (401/403) que E04-HU01 (D26).

## Decisiones aplicadas

- Ver [D29](../DECISIONES.md) para el orden Corte A/Corte B, los códigos
  de error, el emparejamiento por `cod_indicador_producto`, el criterio de
  "solo cambios" y la exportación (SUPUESTO MENOR de columnas).
