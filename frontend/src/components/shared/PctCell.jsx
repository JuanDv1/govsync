/**
 * Celda de porcentaje monoespaciada, con color condicional por umbral
 * (≥60% verde, ≥30% ámbar, <30% rojo).
 *
 * Sin consumidor todavía en este sprint — ninguna pantalla actual muestra
 * un porcentaje de avance. Se porta ahora, igual que `SemaforoDot`, para
 * cuando una pantalla lo necesite.
 */
export default function PctCell({ valor }) {
  if (valor === null || valor === undefined) {
    return <span className="font-mono text-xs text-gray-400">—</span>;
  }

  const color =
    valor >= 60
      ? "text-semaforo-verde"
      : valor >= 30
        ? "text-semaforo-amarillo"
        : "text-semaforo-rojo";

  return (
    <span className={`font-mono text-xs font-medium ${color}`}>
      {Math.round(valor)}%
    </span>
  );
}
