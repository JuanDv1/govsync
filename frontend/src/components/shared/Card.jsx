/**
 * Envoltura de tarjeta usada en toda la app: fondo blanco, borde sutil,
 * radio de 16px (`rounded-tarjeta`) y una sombra suave (`shadow-suave`).
 * Antes llevaba radio de 2px y sin sombra (docs/DECISIONES.md D19 y D20).
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
      className={`rounded-tarjeta border border-gray-200 bg-white shadow-suave ${padding} ${className}`}
      {...resto}
    >
      {children}
    </Etiqueta>
  );
}
