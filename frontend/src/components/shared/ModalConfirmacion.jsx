/**
 * Diálogo de confirmación modal, genérico (sin texto fijo de ningún flujo).
 *
 * TARJETA: [E02-HU05/CA-3] — primer y único consumidor hoy.
 *
 * No hay ningún componente de modal en el repo todavía (D19/D20 solo
 * cubrieron átomos de tabla/estado); este es deliberadamente mínimo: sin
 * libería de diálogo (no se justifica para un solo consumidor), sin portal
 * de React — un `position: fixed` con overlay es suficiente para una sola
 * pantalla a la vez.
 *
 * Accesibilidad mínima sin librerías nuevas: al montarse enfoca el botón
 * de "Cancelar" (acción segura por defecto si alguien presiona Enter sin
 * querer) y Escape equivale a cancelar, igual que el clic en el overlay.
 */
import { useEffect, useRef } from "react";

export default function ModalConfirmacion({
  titulo = "Confirmar",
  mensaje,
  textoConfirmar = "Continuar",
  textoCancelar = "Cancelar",
  onConfirmar,
  onCancelar,
}) {
  const botonCancelarRef = useRef(null);

  useEffect(() => {
    botonCancelarRef.current?.focus();
  }, []);

  useEffect(() => {
    function manejarTecla(evento) {
      if (evento.key === "Escape") onCancelar();
    }
    document.addEventListener("keydown", manejarTecla);
    return () => document.removeEventListener("keydown", manejarTecla);
  }, [onCancelar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onCancelar}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-confirmacion-titulo"
        aria-describedby="modal-confirmacion-mensaje"
        // Detiene la propagación del clic: el overlay cierra el modal al
        // hacer clic afuera, pero un clic dentro de la tarjeta no debe
        // propagarse hasta el overlay y cerrarla por accidente.
        onClick={(evento) => evento.stopPropagation()}
        className="w-full max-w-sm rounded-sm border border-gray-200 bg-white p-5 shadow-lg"
      >
        <p
          id="modal-confirmacion-titulo"
          className="text-sm font-semibold text-gray-800"
        >
          {titulo}
        </p>
        <p
          id="modal-confirmacion-mensaje"
          className="mt-2 text-xs text-gray-600"
        >
          {mensaje}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={botonCancelarRef}
            type="button"
            onClick={onCancelar}
            className="rounded-sm border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-hover"
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
