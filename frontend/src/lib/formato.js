/** Formatea un monto en pesos colombianos: separador de miles, sin decimales, prefijo "$ ". */
export function cop(n) {
  return `$ ${Math.round(n).toLocaleString("es-CO")}`;
}
