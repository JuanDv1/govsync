/** Label uppercase gris para encabezar un bloque dentro de una tarjeta. */
export default function SectionHeader({ children, className = "" }) {
  return (
    <p
      className={`mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 ${className}`}
    >
      {children}
    </p>
  );
}
