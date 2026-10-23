/**
 * Botón "Exportar a Excel" con sus mensajes de éxito y error.
 *
 * TARJETA: [E04-HU04] Comparar dos cortes (frontend), CA08 (exportar)
 *
 * Es el mismo comportamiento del botón de [E04-HU03] en `PlanAccion.jsx`,
 * empaquetado para reutilizarlo. DEUDA: `PlanAccion.jsx` todavía tiene su
 * propia copia; migrarla a este componente queda para un PR aparte (aquí no se
 * tocó para no arriesgar HU-03).
 *
 * - `descargar()` devuelve `{ blob, nombre }` (p. ej. una función de
 *   `api/cliente.js` que usa `descargarExcel`). Se llama al hacer clic.
 * - `nombreRespaldo`: el nombre si el navegador no expone
 *   `Content-Disposition`.
 * - `mensajeDeError(error)`: el texto que se muestra si algo falla.
 * - `deshabilitado`: `disabled` nativo (p. ej. sin filas que exportar).
 * - `alCambiarExportando(bool)`: opcional, avisa al padre al empezar y al
 *   terminar (para bloquear controles que cambiarían lo que se exporta).
 *
 * Mientras exporta NO se usa `disabled` (algunos navegadores sacan el foco del
 * botón): `aria-disabled`, `aria-busy`, el texto "Generando archivo…" y un
 * ref que ignora un segundo clic. Un intento nuevo borra el mensaje anterior;
 * el éxito se anuncia en una región `aria-live` siempre montada y el error
 * solo con `role="alert"`. Para borrar los mensajes cuando cambia lo que se
 * ve, quien lo usa le cambia la `key` (se monta de nuevo, sin efectos).
 */
import { CircleAlert, CircleCheck, Download, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";

import { guardarArchivo } from "../lib/descarga.js";

//: Mismas clases que `BOTON_FILTROS` de `PlanAccion.jsx` (40 px, 14 px, foco
//: visible) más el aspecto deshabilitado, que no depende solo del color.
const BOTON =
  "inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-gray-300 bg-white px-3 text-sm font-medium text-azul hover:bg-secundario focus:outline-none focus-visible:ring-2 focus-visible:ring-azul focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-gray-50 disabled:text-gray-500 aria-disabled:cursor-progress aria-disabled:bg-gray-50";

export default function BotonExportarExcel({
  descargar,
  nombreRespaldo,
  mensajeDeError,
  deshabilitado = false,
  tituloDeshabilitado,
  alCambiarExportando,
}) {
  const [exportando, setExportando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [mensajeError, setMensajeError] = useState("");
  const refExportando = useRef(false);

  async function exportar() {
    if (deshabilitado || refExportando.current) return;
    refExportando.current = true;
    setExportando(true);
    alCambiarExportando?.(true);
    setMensajeExito("");
    setMensajeError("");

    try {
      const { blob, nombre } = await descargar();
      const nombreArchivo = nombre ?? nombreRespaldo;
      guardarArchivo(blob, nombreArchivo);
      setMensajeExito(`Descarga lista: ${nombreArchivo}`);
    } catch (error) {
      setMensajeError(mensajeDeError(error));
    } finally {
      refExportando.current = false;
      setExportando(false);
      alCambiarExportando?.(false);
    }
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={exportar}
        disabled={deshabilitado}
        aria-disabled={exportando || undefined}
        aria-busy={exportando}
        title={deshabilitado ? tituloDeshabilitado : undefined}
        className={BOTON}
      >
        {exportando ? (
          <LoaderCircle
            size={16}
            aria-hidden="true"
            className="motion-safe:animate-spin"
          />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
        {exportando ? "Generando archivo…" : "Exportar a Excel"}
      </button>

      <p
        aria-live="polite"
        className={`flex items-center gap-2 text-sm font-medium text-green-800 ${mensajeExito ? "mt-2" : ""}`}
      >
        {mensajeExito && (
          <>
            <CircleCheck size={16} aria-hidden="true" className="shrink-0" />
            <span>{mensajeExito}</span>
          </>
        )}
      </p>
      {mensajeError && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <CircleAlert
            size={16}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span>{mensajeError}</span>
        </p>
      )}
    </div>
  );
}
