/**
 * [E02-HU05] Un solo criterio de "¿es este el corte actual?", compartido
 * por `Cortes.jsx` y `EditarArchivosCorteActual.jsx` — antes cada pantalla
 * tenía su propia lógica y terminaban en desacuerdo sobre el mismo corte.
 *
 * `corte.es_corte_actual` es PROPUESTA (ver
 * docs/specs/E02-HU05-modificar-archivos-corte-actual.md, Contrato) — el
 * backend todavía no lo envía. Mientras no exista, el fallback es el primer
 * corte `REGISTRADO` de `cortes`, una lista que el backend YA entrega
 * ordenada por fecha de corte y fecha de creación descendentes
 * (`GET /cortes`) — no es recalcular el orden, solo leer una posición en el
 * orden que el backend ya decidió. En cuanto el backend envíe el campo,
 * tiene prioridad sobre este fallback.
 */
export function esCorteActual(corte, cortes) {
  if (corte.es_corte_actual !== undefined) return corte.es_corte_actual;
  if (!cortes) return false;
  const actual = cortes.find((c) => c.estado === "REGISTRADO");
  return actual?.id === corte.id;
}
