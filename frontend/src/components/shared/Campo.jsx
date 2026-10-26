/**
 * Campo de formulario: etiqueta visible ENCIMA, el control, una ayuda
 * opcional y un error opcional.
 *
 * - `etiqueta`: texto visible, siempre (un placeholder no sustituye a la
 *   etiqueta: desaparece al escribir).
 * - `variante`: `"texto"` (un `<input>`; pasa `type`, `inputMode`, etc.) o
 *   `"select"` (un `<select>`; las `<option>` van en `children`).
 * - `ayuda`: qué escribir o en qué formato (13 px).
 * - `error`: qué salió mal y cómo corregirlo. Marca el campo con
 *   `aria-invalid` y se anuncia con `role="alert"`.
 * - `id`: opcional; si falta se genera uno.
 * - El resto de las props (`value`, `onChange`, `type`, `disabled`…) van al
 *   control.
 *
 * `aria-describedby` une la ayuda y el error, para que el lector de pantalla
 * los lea al enfocar el campo.
 *
 * ESTILO: 44 px de alto, borde de 1,5 px en `borde-control` (4,8:1, el
 * `gray-300` de antes daba 1,5:1) y anillo de foco de 2 px: el foco nunca se
 * reduce a cambiar el color del borde.
 */
import { CircleAlert } from "lucide-react";
import { useId } from "react";

const CONTROL =
  "min-h-11 w-full rounded-control border-[1.5px] bg-white px-3 text-campo text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-azul-accion focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-gray-100 disabled:text-gray-600";

export default function Campo({
  etiqueta,
  variante = "texto",
  ayuda,
  error,
  id,
  children,
  className = "",
  ...atributos
}) {
  const idAutomatico = useId();
  const idControl = id ?? idAutomatico;
  const idAyuda = `${idControl}-ayuda`;
  const idError = `${idControl}-error`;

  const describedby =
    [atributos["aria-describedby"], ayuda && idAyuda, error && idError]
      .filter(Boolean)
      .join(" ") || undefined;

  const propsControl = {
    ...atributos,
    id: idControl,
    "aria-describedby": describedby,
    "aria-invalid": error ? true : undefined,
    className: `${CONTROL} ${
      error ? "border-red-700" : "border-borde-control"
    } ${className}`,
  };

  return (
    <div>
      <label
        htmlFor={idControl}
        className="mb-1.5 block text-campo font-medium text-gray-700"
      >
        {etiqueta}
      </label>

      {variante === "select" ? (
        <select {...propsControl}>{children}</select>
      ) : (
        <input {...propsControl} />
      )}

      {ayuda && (
        <p id={idAyuda} className="mt-1.5 text-ayuda text-gray-600">
          {ayuda}
        </p>
      )}
      {error && (
        <p
          id={idError}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-ayuda font-medium text-red-700"
        >
          <CircleAlert
            size={16}
            aria-hidden="true"
            className="mt-px shrink-0"
          />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
