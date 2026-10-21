/** Formatea un monto en pesos colombianos: separador de miles, sin decimales, prefijo "$ ". */
export function cop(n) {
  return `$ ${Math.round(n).toLocaleString("es-CO")}`;
}

/**
 * [E04-HU01/CA08] Porcentaje con 1 decimal y coma decimal ("24,0%", "0,0%").
 * Acepta el texto Decimal que manda el backend. Sin semáforo ni umbrales: es
 * un formato de cifra, no una valoración (a diferencia de `PctCell`).
 */
export function pct(valor) {
  const texto = Number(valor).toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${texto}%`;
}

/**
 * [E04-HU01] Cantidad con hasta 2 decimales y sin ceros sobrantes ("100",
 * "0,2"). Para la meta programada, que el backend manda con 4 decimales
 * ("100.0000"). Acepta texto Decimal o número.
 */
export function numero(valor) {
  return Number(valor).toLocaleString("es-CO", { maximumFractionDigits: 2 });
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
