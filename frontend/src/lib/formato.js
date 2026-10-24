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

/**
 * [E04-HU04] Fecha de corte "AAAA-MM-DD" → "DD/MM/AAAA" partiendo el texto.
 * Nunca `new Date(iso)`: lo interpreta como UTC y en Colombia muestra el día
 * anterior. Copia de la función local de `PlanAccion.jsx` (deuda: que esa
 * pantalla use esta). `null`/`undefined` devuelve `null`.
 */
export function fechaCorte(iso) {
  if (!iso) return null;
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * Valor absoluto con `decimales` fijos, o con 2 si con `decimales` quedaría en
 * cero sin serlo (un Δ distinto de 0 nunca se muestra como "0").
 */
function absolutoLegible(n, decimales) {
  const formatear = (cifras) =>
    Math.abs(n).toLocaleString("es-CO", {
      minimumFractionDigits: cifras,
      maximumFractionDigits: cifras,
    });
  const texto = formatear(decimales);
  return n !== 0 && Number(Math.abs(n).toFixed(decimales)) === 0
    ? formatear(2)
    : texto;
}

//: Signo de un Δ: "+" o "−" (signo menos tipográfico, no el guion).
function signo(n) {
  if (n > 0) return "+";
  if (n < 0) return "−";
  return "";
}

/**
 * [E04-HU04/CA05] Δ de ejecución en pesos, con signo: "+$ 1.234.567",
 * "−$ 50.000", "$ 0". Pesos enteros; si el Δ es distinto de 0 pero
 * redondearía a "$ 0", lleva 2 decimales ("+$ 0,30"). `null` si no hay Δ.
 * Acepta el texto Decimal del backend.
 */
export function copConSigno(valor) {
  if (valor == null) return null;
  const n = Number(valor);
  return `${signo(n)}$ ${absolutoLegible(n, 0)}`;
}

/**
 * [E04-HU04/CA05] Δ de un porcentaje en puntos porcentuales, con signo:
 * "+2,5 pp", "−0,8 pp", "0,0 pp". 1 decimal; si el Δ es distinto de 0 pero
 * redondearía a 0, lleva 2 ("+0,03 pp"). `null` si no hay Δ.
 */
export function ppConSigno(valor) {
  if (valor == null) return null;
  const n = Number(valor);
  return `${signo(n)}${absolutoLegible(n, 1)} pp`;
}
