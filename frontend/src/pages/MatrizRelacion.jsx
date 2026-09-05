/**
 * Matriz de relación del corte.
 *
 * TARJETAS: [HU-07][FE-02] Tabla de la matriz de relación
 *           [HU-07][FE-03] Representación explícita de la información no relacionada
 *           [HU-07][FE-04] Integración y rendimiento de la tabla
 *
 * DOS COSAS QUE NO SE PUEDEN PERDER EN ESTA PANTALLA
 *
 * 1. CA-8: lo que no se pudo relacionar se muestra como AUSENCIA EXPLÍCITA
 *    (un guion, un "sin cruce"), nunca como celda vacía ambigua ni como "N/A"
 *    inventado. La distinción entre "no hay dato" y "hay dato vacío" viaja
 *    desde el backend como null y debe seguir siendo visible aquí.
 *
 * 2. Los códigos se muestran con la clase `.codigo` (monoespaciada): es lo que
 *    hace visible el cero a la izquierda de 040110500.
 *
 * Las columnas las envía el backend junto con los datos: no codificarlas aquí,
 * o el contrato de las seis columnas se desalinea en silencio.
 */
export default function MatrizRelacion() {
  return null; // TODO [HU-07][FE-02]
}
