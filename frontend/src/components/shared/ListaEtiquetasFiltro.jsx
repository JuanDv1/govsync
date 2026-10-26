/**
 * Lista de etiquetas de filtros activos, con el foco que se mueve al quitar una.
 *
 * Compartida por `FiltrosMatriz.jsx` y `FiltrosPlanAccion.jsx`: cada pantalla
 * arma su arreglo de etiquetas y esta lista las pinta con `EtiquetaFiltro`.
 *
 * - `etiquetas`: `{ clave, valor, titulo, texto }` por filtro activo. Si no hay
 *   ninguna, no pinta nada.
 * - `onQuitar(clave, valor)`: avisa al padre de la etiqueta quitada.
 * - `refBotonFiltros`: ref del botón «Filtros», adonde vuelve el foco cuando no
 *   queda ninguna etiqueta.
 *
 * FOCO AL QUITAR UNA ETIQUETA: la ✕ pulsada desaparece con su etiqueta, así que
 * el foco se mueve ANTES de avisar al padre, dentro del propio manejador (nada
 * de efectos ni de estado): a la ✕ de la etiqueta siguiente, o a la de la
 * anterior si era la última, o al botón «Filtros» si no queda ninguna.
 */
import { useRef } from "react";

import EtiquetaFiltro from "./EtiquetaFiltro.jsx";

export default function ListaEtiquetasFiltro({
  etiquetas,
  onQuitar,
  refBotonFiltros,
}) {
  // ✕ montados, por `clave:valor`. Cada ref de callback se auto-limpia al
  // desmontarse la etiqueta, así que nunca se enfoca un nodo que ya no está.
  const botonesQuitar = useRef(new Map());

  if (etiquetas.length === 0) return null;

  const idDe = (etiqueta) => `${etiqueta.clave}:${etiqueta.valor}`;

  function quitar(indice) {
    const etiqueta = etiquetas[indice];
    const vecino = [etiquetas[indice + 1], etiquetas[indice - 1]]
      .filter(Boolean)
      .map((candidata) => botonesQuitar.current.get(idDe(candidata)))
      .find(Boolean);
    (vecino ?? refBotonFiltros?.current)?.focus();
    onQuitar(etiqueta.clave, etiqueta.valor);
  }

  return (
    <ul aria-label="Filtros activos" className="mt-4 flex flex-wrap gap-2">
      {etiquetas.map((etiqueta, indice) => (
        <EtiquetaFiltro
          key={idDe(etiqueta)}
          texto={`${etiqueta.titulo}: ${etiqueta.texto}`}
          etiquetaAria={`Quitar filtro ${etiqueta.titulo} ${etiqueta.texto}`}
          refBoton={(boton) => {
            if (boton) botonesQuitar.current.set(idDe(etiqueta), boton);
            else botonesQuitar.current.delete(idDe(etiqueta));
          }}
          onQuitar={() => quitar(indice)}
        />
      ))}
    </ul>
  );
}
