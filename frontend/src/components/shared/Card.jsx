/**
 * Envoltura de tarjeta usada en toda la app: fondo blanco, borde sutil,
 * radio de 2px (ver docs/DECISIONES.md D18 y D19).
 *
 * `as` permite usarla como `<form>` (ej. el formulario de "Datos del
 * corte") sin duplicar las clases en cada lugar que necesita el look de
 * tarjeta pero no es semánticamente un `<div>`.
 */
export default function Card({
  as: Etiqueta = "div",
  children,
  className = "",
  padding = "p-5",
  ...resto
}) {
  return (
    <Etiqueta
      className={`rounded-sm border border-gray-200 bg-white ${padding} ${className}`}
      {...resto}
    >
      {children}
    </Etiqueta>
  );
}
