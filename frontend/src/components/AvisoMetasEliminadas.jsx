/**
 * Aviso de metas que el archivo de reemplazo ya no trae.
 *
 * TARJETA: [E02-HU05] Modificar archivos del corte actual
 * CUBRE: CA-7 ("si alguna meta deja de existir, el sistema lo informa en el
 * resultado del recálculo"), solo la parte de informar. No conserva ni
 * descarta avance físico: E-03 no existe todavía (D25).
 *
 * PROPS, NO CONSUMO DE API: recibe `metas` ya resuelto (campo
 * `metas_eliminadas` de la respuesta de `POST /cortes/{id}/archivos/{tipo}/reemplazo`,
 * lista de códigos de indicador de producto). No muestra nada si está vacía.
 */
import { AlertTriangle } from "lucide-react";

export default function AvisoMetasEliminadas({ metas }) {
  if (!metas?.length) return null;

  return (
    <div
      role="status"
      className="mt-2 flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2.5"
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
      <div className="text-campo text-amber-800">
        <p>
          {metas.length === 1
            ? "1 meta del corte ya no está en el archivo nuevo:"
            : `${metas.length} metas del corte ya no están en el archivo nuevo:`}
        </p>
        <p className="mt-0.5 font-mono">{metas.join(", ")}</p>
      </div>
    </div>
  );
}
