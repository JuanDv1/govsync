/**
 * Etiqueta (chip) de un filtro activo: el texto y una ✕ para quitarlo.
 *
 * Es PURAMENTE presentacional. Quien la usa (`FiltrosMatriz.jsx` y
 * `FiltrosPlanAccion.jsx`) conserva la lógica: la `key` del `<li>`, el mapa de
 * ✕ por etiqueta y el foco que se mueve al quitar una.
 *
 * - `texto`: lo que se ve, por ejemplo «Sector: Salud».
 * - `etiquetaAria`: el `aria-label` de la ✕ («Quitar filtro Sector Salud»).
 * - `refBoton`: ref de callback de la ✕, para que el padre la pueda enfocar.
 * - `onQuitar`: se llama al pulsar la ✕.
 *
 * La ✕ mide 32 px (excepción conocida: WCAG 2.2 AA pide 24 px) y lleva el
 * anillo de foco de 2 px.
 */
import { X } from "lucide-react";

export default function EtiquetaFiltro({
  texto,
  etiquetaAria,
  refBoton,
  onQuitar,
}) {
  return (
    <li className="inline-flex items-center gap-1 rounded-control border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-0.5 text-campo font-medium text-azul">
      <span>{texto}</span>
      <button
        ref={refBoton}
        type="button"
        aria-label={etiquetaAria}
        onClick={onQuitar}
        className="inline-flex h-8 w-8 items-center justify-center rounded-control text-azul hover:bg-blue-100 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-azul"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
