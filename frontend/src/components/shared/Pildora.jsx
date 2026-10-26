/**
 * Píldora de estado: texto corto sobre un fondo suave, con borde.
 *
 * Es el ÚNICO lugar con los tonos y los tamaños de las píldoras:
 * `StateBadge.jsx` es un alias de este componente, así que ninguna pantalla
 * que ya lo importaba cambia. La píldora (`rounded-full`) se usa solo para
 * estados; botones, campos y listas llevan el radio `control`.
 *
 * El color lo decide quien llama (`tono`), no un mapa interno de texto →
 * color: sirve para "Borrador"/"Registrado" (Cortes), "Completo"/"Parcial"
 * (Plan de Acción) o cualquier otro estado sin tocar este componente. Nunca
 * dependas solo del color: el `texto` siempre dice el estado.
 *
 * Los tonos verde/ámbar/rojo NO son los del semáforo (`SemaforoDot`, tokens
 * `semaforo.*`): son fondos suaves para una caja de texto.
 */
const TONOS = {
  verde: "border-green-200 bg-green-50 text-green-700",
  azul: "border-blue-200 bg-blue-50 text-azul",
  ambar: "border-amber-200 bg-amber-50 text-amber-800",
  rojo: "border-red-200 bg-red-50 text-critico",
  gris: "border-gray-200 bg-gray-50 text-gray-600",
};

//: `normal` es el tamaño de siempre. `grande` lo usa el Plan de Acción
//: (E04-HU01), que necesita más aire. Texto de 13 px (`normal`) y de 14 px
//: (`grande`).
const TAMANOS = {
  normal: "px-2.5 py-0.5 text-ayuda",
  grande: "px-3 py-1 text-campo",
};

export default function Pildora({
  texto,
  tono = "gris",
  tamano = "normal",
  icono: Icono,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        TAMANOS[tamano] ?? TAMANOS.normal
      } ${TONOS[tono] ?? TONOS.gris}`}
    >
      {Icono && <Icono size={14} aria-hidden="true" />}
      {texto}
    </span>
  );
}
