/** Formatea un monto en pesos colombianos: separador de miles, sin decimales, prefijo "$ ". */
export function cop(n) {
  return `$ ${Math.round(n).toLocaleString("es-CO")}`;
}

/**
 * [E02-HU05] Formatea una fecha/hora ISO (`fecha_carga`) a "DD/MM/AAAA, HH:mm".
 * `null`/`undefined` devuelve `null` en vez de una cadena vacía, para que
 * quien llama decida el texto de reemplazo (p. ej. "—") sin ambigüedad.
 */
export function fechaHora(iso) {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
