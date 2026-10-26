/**
 * Clases base de las tablas del Plan de Acción y de la comparación de cortes.
 * Solo cadenas de clases y una función pequeña de presentación (`fondoDeFila`);
 * cada pantalla las compone con lo suyo (`className={`${TH} text-right`}`).
 *
 * Convenciones que estas constantes suponen:
 * - La tabla es `border-separate border-spacing-0`, así que los bordes van en
 *   cada celda (no en la fila). Con `border-collapse` se pierden los bordes de
 *   las columnas fijas al desplazarse.
 * - Las celdas con `sticky` necesitan fondo opaco: en el cuerpo, la misma
 *   clase de `fondoDeFila(indice)` que lleva su fila, puesta EXPLÍCITA en la
 *   celda (no `bg-inherit`: no depende de cómo cada navegador pinte el fondo
 *   del `tr` bajo una celda `sticky`); en el encabezado, `TH` ya lleva fondo.
 * - Los números y los códigos van en `font-mono`; los montos y porcentajes,
 *   con `whitespace-nowrap` y alineados a la derecha.
 */

//: Encabezado de columna SIN fondo ni color de texto: 12 px en mayúsculas. Sirve
//: para los encabezados que llevan su propio tinte y texto (grupos de columnas);
//: así no compiten dos clases `bg-*` ni dos `text-*` por el orden del CSS.
export const TH_BASE =
  "whitespace-nowrap border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide";

//: Encabezado de columna con el gris suave de siempre (7,2:1 el texto).
export const TH = `${TH_BASE} bg-gray-50 text-gray-600`;

//: Celda de dato: 14 px y separador horizontal suave de 1 px.
export const TD = "border-b border-borde-suave px-4 py-3 text-campo align-top";

/**
 * Fondo de la fila de datos número `indice` (0, 1, 2…): blanco y gris muy
 * suave, alternados. Se pinta en el `<tr>`; la señal ámbar de "dato vacío" es
 * un fondo de CELDA y la tapa, y el detalle expandido tiene el suyo.
 */
export function fondoDeFila(indice) {
  return indice % 2 === 0 ? "bg-white" : "bg-fondo-fila";
}
