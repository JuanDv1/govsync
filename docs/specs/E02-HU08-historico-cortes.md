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

- **Incluye:** cantidad de metas por corte en el histórico (CA03) y corte
  de referencia por vigencia (CA04), en backend y en frontend
  (`pages/Cortes.jsx`).
- **Fuera de alcance:** que la referencia cambie "Comparar cortes"
  (preseleccionarla). No se implementa.

## Actores y permisos

`GET /cortes`: lectura, `administrador` o `visitante` (D24 y D37).

## Criterios de aceptación

Los de la hoja «HU_E02_08», sin cambios.

| ID            | Estado en backend                                                   | Estado en frontend                                                  |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| E02-HU08-CA01 | Implementado (Sprint 1); `test_hu08_hu09_historico.py`              | Implementado (Sprint 1)                                             |
| E02-HU08-CA02 | Implementado (Sprint 1); `test_hu08_hu09_historico.py`              | Implementado (Sprint 1)                                             |
| E02-HU08-CA03 | Implementado: `cantidad_metas` por corte en `GET /cortes` (#212)    | Implementado: columna "Metas" en `Cortes.jsx`                       |
| E02-HU08-CA04 | Implementado: `es_referencia`, `PUT`/`DELETE .../referencia` (#214) | Implementado: estrella y "Marcar/Quitar referencia" en `Cortes.jsx` |

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

### Frontend (CA03 y CA04, `pages/Cortes.jsx`)

Decisiones del PO registradas en las tarjetas (vinculantes):

- **CA03:** columna "Metas". `null` (BORRADOR) se muestra "—", nunca 0; un
  REGISTRADO con 0 metas muestra 0. El frontend no calcula el número.
- **CA04, quién ve y quién actúa:** la estrella la ven todos los roles con
  acceso a la pantalla (administrador y visitante con cuenta); "Marcar
  referencia" / "Quitar referencia" solo con `puedeEscribir` y solo en cortes
  REGISTRADOS. Es solo UI: el backend responde 403 a quien no es
  administrador.
- **CA04, accesibilidad:** la estrella es ícono + texto, no solo color. A
  lectores de pantalla se les lee «Corte de referencia de la vigencia 2026»;
  a la vista, «Referencia».
- **CA04, una estrella por vigencia:** tras un `PUT`/`DELETE` exitoso se
  recarga `GET /cortes` sin pantalla de carga; el frontend no replica la regla
  de mover la marca (la aplica el backend). Si la recarga falla se muestra el
  error en lugar de la lista anterior, para no dejar dos estrellas.
- **CA04, errores:** 404/409 se muestran con `EstadoError` (con
  `error.detalles`) y la lista queda como estaba; "Reintentar" recarga el
  histórico. Mientras una petición está en curso, todos los botones de
  referencia quedan deshabilitados y se ignora el doble clic.
- **Métodos de `api/cliente.js`:** `marcarCorteReferencia(id)` (`PUT`) y
  `desmarcarCorteReferencia(id)` (`DELETE`); ambos devuelven el corte.
- Pruebas: `pages/Cortes.test.jsx` y `api/cliente.test.js`.
