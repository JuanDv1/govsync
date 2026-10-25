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
 * querer) y Escape equivale a cancelar. El overlay NO tiene su propio
 * manejador de clic a propósito (SonarCloud: un elemento no interactivo
 * con `onClick` necesita soporte de teclado, y un `<div>` no es el
 * elemento correcto para eso) — cerrar el modal ya tiene dos caminos
 * accesibles de sobra: el botón "Cancelar" y Escape.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-confirmacion-titulo"
        aria-describedby="modal-confirmacion-mensaje"
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
          className="mt-2 text-campo text-gray-600"
        >
          {mensaje}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={botonCancelarRef}
            type="button"
            onClick={onCancelar}
            className="rounded-sm border border-gray-300 px-3 py-1.5 text-campo font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="rounded-sm bg-navy px-3 py-1.5 text-campo font-semibold text-white transition-colors hover:bg-navy-hover"
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
