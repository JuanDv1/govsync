/**
 * [E02-HU05] Un solo criterio de "¿es este el corte actual?", compartido
 * por `Cortes.jsx` y `EditarArchivosCorteActual.jsx` — antes cada pantalla
 * tenía su propia lógica y terminaban en desacuerdo sobre el mismo corte.
 *
 * `corte.es_corte_actual` lo calcula el backend y viene en `GET /cortes` y
 * `GET /cortes/{id}` (ver docs/specs/E02-HU05-modificar-archivos-corte-actual.md,
 * Contrato): tiene prioridad. El fallback solo se usa si la respuesta no
 * trae el campo (p. ej. un backend desplegado sin ese cambio): es el primer
 * corte `REGISTRADO` de `cortes`, una lista que el backend entrega ordenada
 * por fecha de corte y fecha de creación descendentes (`GET /cortes`) — no es
 * recalcular el orden, solo leer una posición en el orden que el backend ya
 * decidió.
 */
export function esCorteActual(corte, cortes) {
  if (corte.es_corte_actual !== undefined) return corte.es_corte_actual;
  if (!cortes) return false;
  const actual = cortes.find((c) => c.estado === "REGISTRADO");
  return actual?.id === corte.id;
}
