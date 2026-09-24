/**
 * Punto de color para semáforo de estado (verde/ámbar/rojo/sin información).
 *
 * Sin consumidor todavía en este sprint — PLANDETRABAJO.md no tiene tarjeta
 * de Tablero/indicadores que lo necesite hoy. Se porta ahora porque
 * DESIGN_SPEC.md lo lista como átomo base, listo para cuando una pantalla
 * (ej. Matriz o Cortes) necesite mostrar un estado de semáforo.
 */
const COLORES = {
  verde: "bg-semaforo-verde",
  amarillo: "bg-semaforo-amarillo",
  rojo: "bg-semaforo-rojo",
  sin_info: "bg-semaforo-sin-info",
};

export default function SemaforoDot({ estado, titulo }) {
  return (
    <span
      role="img"
      aria-label={titulo ?? estado}
      title={titulo}
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        COLORES[estado] ?? COLORES.sin_info
      }`}
    />
  );
}
