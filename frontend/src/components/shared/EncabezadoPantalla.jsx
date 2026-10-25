/**
 * Encabezado de una pantalla: título, descripción corta y, a la derecha, las
 * acciones principales (por ejemplo un `Boton`).
 *
 * Va SIEMPRE visible, también mientras la pantalla carga o falla: así la
 * persona sabe dónde está (DESIGN_SPEC §4.2, D20).
 *
 * - `titulo`: el único `h1` de la pantalla (24 px).
 * - `descripcion`: una frase que diga qué muestra la pantalla (15 px).
 * - `acciones`: botones u otros controles; pasan a una segunda línea si no
 *   caben, nunca se cortan.
 */
export default function EncabezadoPantalla({ titulo, descripcion, acciones }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-pantalla font-semibold text-gray-800">{titulo}</h1>
        {descripcion && (
          <p className="mt-1 text-cuerpo text-gray-600">{descripcion}</p>
        )}
      </div>
      {acciones && (
        <div className="flex flex-wrap items-center gap-3">{acciones}</div>
      )}
    </header>
  );
}
