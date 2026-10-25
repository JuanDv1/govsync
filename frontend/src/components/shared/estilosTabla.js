/**
 * Clases base de las tablas. Solo cadenas de clases, sin lógica ni
 * componentes: cada pantalla las compone con lo suyo
 * (`className={`${TH} text-right`}`).
 *
 * Convenciones que ya cumplen las tablas del Plan de Acción y de la
 * comparación, y que estas constantes suponen:
 * - La tabla es `border-separate border-spacing-0`, así que los bordes van en
 *   cada celda (no en la fila). Con `border-collapse` se pierden los bordes de
 *   las columnas fijas al desplazarse.
 * - Las celdas con `sticky` necesitan fondo opaco (`bg-white`, `bg-gray-50`).
 * - Los números y los códigos van en `font-mono`; los montos y porcentajes,
 *   con `whitespace-nowrap` y alineados a la derecha.
 *
 * TODAVÍA NO las usan el Plan de Acción ni Comparar, que mantienen sus propias
 * copias hasta la Fase 3 del refresh visual.
 */

//: Encabezado de columna: 12 px en mayúsculas, `gray-600` (6,7:1 sobre el
//: gris del encabezado).
export const TH =
  "whitespace-nowrap border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";

//: Celda de dato: 14 px.
export const TD = "border-b border-gray-100 px-4 py-3 text-campo align-top";
