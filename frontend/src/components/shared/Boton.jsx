/**
 * Botón del sistema: variantes primario, secundario y peligro, de 44 px de
 * alto, texto de 14 px en negrita y anillo de foco de 2 px.
 *
 * - `to`: si viene, se renderiza como `Link` de react-router (un enlace que
 *   se ve como botón); si no, como `<button>` (`type="button"` por defecto).
 * - `icono`: componente de lucide-react opcional, a la izquierda del texto.
 *
 * CONVENCIÓN "DESHABILITADO + MOTIVO VISIBLE"
 * Un botón deshabilitado sin explicación deja a la persona sin saber qué
 * hacer. Cuando hay un motivo, se escribe junto al botón (`motivo`) y el
 * botón NO usa el atributo `disabled`, sino `aria-disabled="true"` y
 * `aria-describedby` apuntando a ese texto:
 *   - un botón con `disabled` sale del orden del teclado y el lector de
 *     pantalla no lo encuentra ni lee por qué está inactivo; con
 *     `aria-disabled` se puede enfocar y se anuncia el motivo;
 *   - el clic se bloquea igual (`preventDefault`), también el envío de un
 *     formulario.
 * Sin `motivo`, `deshabilitado` usa el atributo `disabled` nativo (un enlace
 * no tiene `disabled`: ahí queda `aria-disabled` y fuera del orden del
 * teclado). El estado inactivo no depende solo del color: gris, borde
 * discontinuo y cursor de "no permitido".
 * Ejemplo en uso: `BotonCompararCortes` en `pages/PlanAccion.jsx`.
 *
 * COLORES (contraste con el texto): primario `azul-accion` + blanco 6,7:1;
 * peligro `critico` + blanco 5,5:1; secundario `azul-accion` sobre blanco 6,7:1
 * con borde `borde-control` (4,8:1).
 */
import { useId } from "react";
import { Link } from "react-router-dom";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-campo font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-azul-accion focus-visible:ring-offset-2";

const VARIANTES = {
  primario: "bg-azul-accion text-white hover:bg-azul-accion-hover",
  secundario:
    "border-[1.5px] border-borde-control bg-white text-azul-accion hover:bg-tinte-azul",
  peligro: "bg-critico text-white hover:bg-red-800",
};

//: Aspecto completo de la variante secundaria, para lo que se ve como botón
//: pero no es un `<button>` ni un `Link` (por ejemplo el texto «Seleccionar
//: archivo» dentro del `<label>` de una zona de carga).
export const ESTILO_SECUNDARIO = `${BASE} ${VARIANTES.secundario}`;

//: Estado inactivo, igual para las tres variantes.
const INACTIVO =
  "cursor-not-allowed border-[1.5px] border-dashed border-gray-400 bg-gray-100 text-gray-600";

export default function Boton({
  variante = "primario",
  to,
  icono: Icono,
  deshabilitado = false,
  motivo,
  type = "button",
  onClick,
  className = "",
  children,
  ...resto
}) {
  const idMotivo = useId();
  const conMotivo = deshabilitado && Boolean(motivo);
  const clases = `${BASE} ${
    deshabilitado ? INACTIVO : (VARIANTES[variante] ?? VARIANTES.primario)
  } ${className}`;

  function alHacerClic(evento) {
    if (deshabilitado) {
      evento.preventDefault();
      return;
    }
    onClick?.(evento);
  }

  const contenido = (
    <>
      {Icono && <Icono size={18} aria-hidden="true" />}
      {children}
    </>
  );

  const control =
    to !== undefined ? (
      <Link
        to={to}
        onClick={alHacerClic}
        aria-disabled={deshabilitado || undefined}
        aria-describedby={conMotivo ? idMotivo : undefined}
        tabIndex={deshabilitado && !conMotivo ? -1 : undefined}
        className={clases}
        {...resto}
      >
        {contenido}
      </Link>
    ) : (
      <button
        type={type}
        onClick={alHacerClic}
        disabled={deshabilitado && !conMotivo}
        aria-disabled={conMotivo || undefined}
        aria-describedby={conMotivo ? idMotivo : undefined}
        className={clases}
        {...resto}
      >
        {contenido}
      </button>
    );

  if (!conMotivo) return control;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {control}
      <span id={idMotivo} className="text-ayuda text-gray-600">
        {motivo}
      </span>
    </span>
  );
}
