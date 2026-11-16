# [E02-HU08] Consultar el histórico de cortes

**Estado de la Specification:** Borrador

## Origen

Hoja «HU_E02_08» del levantamiento de requisitos v3.0
(`GovSync_Levantamiento_Requisitos_v3_0_Sprint3.xlsx`). Mientras esta spec
esté en `Borrador`, la fuente de requisitos es esa hoja. CA03 y CA04
estaban pendientes en la decisión #17 y entraron al Sprint 3 por decisión
del PO del 2026-11-11 (tarjetas «[E-02/HU-08] BE+FE - Mostrar cantidad de
metas por corte (CA03)» y «[E-02/HU-08] BE+FE - Marcar corte como
referencia, uno por vigencia (CA04)»).

## Historia

Como administradora, quiero consultar el histórico de cortes, para mantener
la trazabilidad de la información registrada a lo largo del tiempo.

## Alcance

- **Incluye (backend de esta spec):** cantidad de metas por corte en el
  histórico (CA03).
- **Fuera de alcance por ahora:** CA04 (corte de referencia), que va en un
  PR aparte porque necesita migración (ver "Decisiones aplicadas").

## Actores y permisos

`GET /cortes`: lectura, `administrador` o `visitante` (D24 y D37).

## Criterios de aceptación

Los de la hoja «HU_E02_08», sin cambios.

| ID            | Estado en backend                                                         |
| ------------- | ------------------------------------------------------------------------- |
| E02-HU08-CA01 | Implementado (Sprint 1); probado en `test_hu08_hu09_historico.py`         |
| E02-HU08-CA02 | Implementado (Sprint 1); probado en `test_hu08_hu09_historico.py`         |
| E02-HU08-CA03 | Implementado: `cantidad_metas` por corte en `GET /cortes`                 |
| E02-HU08-CA04 | Pendiente: PR aparte, con migración (depende de reparar `migrate-render`) |

## Reglas de negocio

- **Cantidad de metas (CA03):** metas **distintas** (por código de
  indicador de producto) del corte, la misma población que agrega el Plan
  de Acción. No se cuentan filas de la matriz de relación. Ejemplo de la
  tarjeta: el corte del 22/10/2026 tiene 144.
- Un corte que aún no está finalizado (`BORRADOR`) **no tiene cantidad**:
  el backend devuelve `null` y el frontend muestra "—", no 0, porque sus
  metas todavía pueden cambiar. Un corte `REGISTRADO` sin metas devuelve 0.
- Los códigos se comparan como texto: `040110500` y `40110500` son dos
  metas distintas (ceros a la izquierda).

## Contrato

- `GET /api/v1/cortes`: cada elemento agrega `cantidad_metas: int | null`.
  Es un DTO propio del histórico (`CorteHistoricoRespuesta`): las demás
  respuestas que devuelven un corte (detalle, creación, corrección,
  registro) no cambian de forma.
- El conteo sale de **una sola consulta agrupada** para todo el histórico,
  nunca una consulta por corte (probado en
  `test_e02_hu08_cantidad_metas.py`).

## Decisiones aplicadas

- **Dónde vive la regla del BORRADOR:** en la capa de aplicación
  (`ServicioCortes.listar_cortes_con_cantidad_metas`), no en el router.
- **CA04 en un PR aparte:** necesita una columna nueva y su migración; la
  tarjeta pide reparar antes el job `migrate-render` (tarjeta [DEV]).
- `[VALIDAR]` con la clienta que el número que espera es el de metas del
  Plan de Acción y no otro conteo (el ejemplo de 144 metas sale de la
  tarjeta, no de la hoja).
