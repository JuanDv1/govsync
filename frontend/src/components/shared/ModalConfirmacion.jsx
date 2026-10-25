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

import Boton from "./Boton.jsx";

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
        //: `max-h-full overflow-y-auto`: el overlay ya deja 16 px de margen; con
        //: una pantalla de 768 px de alto o con zoom, el contenido se desplaza
        //: dentro del diálogo en vez de cortarse.
        className="max-h-full w-full max-w-md overflow-y-auto rounded-tarjeta border border-gray-200 bg-white p-6 shadow-suave"
      >
        <p
          id="modal-confirmacion-titulo"
          className="text-tarjeta font-semibold text-gray-800"
        >
          {titulo}
        </p>
        <p
          id="modal-confirmacion-mensaje"
          className="mt-3 text-cuerpo text-gray-700"
        >
          {mensaje}
        </p>

        {/* `Boton` pasa el `ref` al <button> (React 19 lo recibe como prop y
            `Boton` lo reenvía con `...resto`), así el foco inicial sigue en
            "Cancelar". Ambos de 44 px. */}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton
            ref={botonCancelarRef}
            variante="secundario"
            onClick={onCancelar}
          >
            {textoCancelar}
          </Boton>
          <Boton onClick={onConfirmar}>{textoConfirmar}</Boton>
        </div>
      </div>
    </div>
  );
}
