//: Título de un bloque dentro de una tarjeta: 14 px en minúsculas y `gray-700`
//: (10,3:1 sobre blanco). Antes iba en 10 px, mayúsculas y `gray-400` (2,5:1).
export default function SectionHeader({ children, className = "" }) {
  return (
    <p className={`mb-3 text-campo font-semibold text-gray-700 ${className}`}>
      {children}
    </p>
  );
}
