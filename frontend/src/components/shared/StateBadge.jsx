/**
 * Pill de estado. El color lo decide quien llama (`tono`), no un mapa interno
 * de texto → color — así sirve para "Borrador"/"Registrado" (Cortes),
 * "Cargada en este corte"/"Reutilizada del corte anterior"/"Pendiente"
 * (NuevoCorte) o cualquier otro estado futuro sin tocar este componente.
 */
const TONOS = {
  verde: "border-green-200 bg-green-50 text-green-700",
  azul: "border-blue-200 bg-blue-50 text-azul",
  ambar: "border-amber-200 bg-amber-50 text-amber-800",
  rojo: "border-red-200 bg-red-50 text-critico",
  gris: "border-gray-200 bg-gray-50 text-gray-500",
};

//: `normal` es el tamaño de siempre (y el valor por defecto). `grande` lo usa
//: el Plan de Acción (E04-HU01), que necesita un texto más legible.
const TAMANOS = {
  normal: "px-2 py-0.5 text-[11px]",
  grande: "px-2.5 py-1 text-xs",
};

export default function StateBadge({
  texto,
  tono = "gris",
  tamano = "normal",
  icono: Icono,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border font-medium ${
        TAMANOS[tamano] ?? TAMANOS.normal
      } ${TONOS[tono] ?? TONOS.gris}`}
    >
      {Icono && <Icono size={12} />}
      {texto}
    </span>
  );
}
