/**
 * Panel de filtros y etiquetas activas de la matriz de relación.
 *
 * TARJETA: [E02-HU10] Filtrar la matriz de relación (frontend)
 * CRITERIOS: HU10-CA01 (panel con los criterios y sus opciones del corte),
 * HU10-CA03/CA04 (autocompletado y listas con buscador), HU10-CA10
 * (etiquetas activas, quitar uno conserva los demás)
 *
 * PRESENTACIONAL: no pide datos ni guarda los filtros. `MatrizRelacion.jsx`
 * es dueña del estado (`filtros`), de la carga de `opciones-filtro` y de la
 * página; este componente recibe todo por props y avisa con `onAgregar` /
 * `onQuitar`. Los selectores usan el patrón de adición de
 * `SelectorConBusqueda`: elegir una opción la agrega al filtro y el campo se
 * vacía; lo elegido se ve como etiqueta.
 *
 * DOS PARTES, CON CICLOS DE VIDA DISTINTOS:
 *   - Etiquetas activas: SIEMPRE visibles (con el panel cerrado también),
 *     una por valor seleccionado. Si las opciones todavía no cargaron o
 *     fallaron, la etiqueta muestra el valor tal cual.
 *   - Panel: solo se muestra con `abierto`. El contenedor siempre existe
 *     (con `hidden` cuando está cerrado) para que `aria-controls` del botón
 *     apunte a un elemento real y el contenido oculto no sea enfocable.
 *
 * ERRORES DE `opciones-filtro` (spec E02-HU10, "Estados y errores"):
 *   - 404 y 409: NO se muestran aquí. La matriz del mismo corte responde lo
 *     mismo y `MatrizRelacion.jsx` ya la reemplaza por un `EstadoError` a
 *     pantalla completa; repetirlo en el panel sería duplicar el mensaje.
 *   - Cualquier otro (red, 401/403, 422): `EstadoError` dentro del panel con
 *     "Reintentar". La tabla y los demás filtros siguen funcionando.
 *   El código HTTP viaja en `ErrorApi.estado` (api/cliente.js).
 *
 * FOCO AL QUITAR UNA ETIQUETA: lo gestiona `shared/ListaEtiquetasFiltro.jsx`
 * (compartida con `FiltrosPlanAccion.jsx`): el foco se mueve ANTES de avisar
 * al padre, al ✕ de la etiqueta siguiente, al de la anterior si era la última,
 * o al botón "Filtros" si no queda ninguna. Todos los destinos están siempre
 * visibles: nunca se enfoca algo del panel cerrado.
 */

import {
  CRITERIOS,
  limitesDeBusqueda,
  opcionesParaCriterio,
} from "../lib/filtros.js";
import { Cargando, EstadoError } from "./Estados.jsx";
import ListaEtiquetasFiltro from "./shared/ListaEtiquetasFiltro.jsx";
import SelectorConBusqueda from "./shared/SelectorConBusqueda.jsx";

//: Estados HTTP cuyo error ya muestra la matriz del mismo corte.
const ESTADOS_QUE_MUESTRA_LA_MATRIZ = new Set([404, 409]);

function EtiquetasActivas({
  filtros,
  opcionesFiltro,
  onQuitar,
  refBotonFiltros,
}) {
  // El `texto` de la opción (p. ej. "040110500 – Tasa de alfabetización")
  // solo existe si las opciones cargaron; si no, se cae al valor.
  const etiquetas = CRITERIOS.flatMap((criterio) => {
    const textos = new Map(
      opcionesParaCriterio(opcionesFiltro, criterio).map((opcion) => [
        opcion.valor,
        opcion.texto,
      ]),
    );
    return (filtros[criterio.clave] ?? []).map((valor) => ({
      clave: criterio.clave,
      titulo: criterio.titulo,
      valor,
      texto: textos.get(valor) ?? valor,
    }));
  });

  return (
    <ListaEtiquetasFiltro
      etiquetas={etiquetas}
      onQuitar={onQuitar}
      refBotonFiltros={refBotonFiltros}
    />
  );
}

function ContenidoPanel({
  filtros,
  opcionesFiltro,
  cargando,
  error,
  onAgregar,
  onReintentar,
}) {
  if (cargando) return <Cargando mensaje="Cargando opciones de filtro…" />;

  if (error) {
    return <EstadoError error={error} onReintentar={onReintentar} />;
  }

  if (!opcionesFiltro) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CRITERIOS.map((criterio) => {
        const { minimo, maximo } = limitesDeBusqueda(criterio);
        return (
          <SelectorConBusqueda
            key={criterio.clave}
            etiqueta={criterio.titulo}
            opciones={opcionesParaCriterio(opcionesFiltro, criterio)}
            seleccionados={filtros[criterio.clave]}
            onAgregar={(valor) => onAgregar(criterio.clave, valor)}
            minCaracteres={minimo}
            maxSugerencias={maximo}
            placeholder="Buscar…"
          />
        );
      })}
    </div>
  );
}

export default function FiltrosMatriz({
  filtros,
  opcionesFiltro,
  cargando,
  error,
  onAgregar,
  onQuitar,
  onReintentar,
  abierto,
  idPanel,
  refBotonFiltros,
}) {
  // 404/409: la matriz ya muestra el error; el panel no aporta nada.
  const panelSinContenido =
    !cargando && error && ESTADOS_QUE_MUESTRA_LA_MATRIZ.has(error.estado);

  return (
    <>
      {!panelSinContenido && (
        <section
          id={idPanel}
          hidden={!abierto}
          aria-label="Filtros de la matriz de relación"
          className="mt-4 border-t border-gray-200 pt-4"
        >
          {abierto && (
            <ContenidoPanel
              filtros={filtros}
              opcionesFiltro={opcionesFiltro}
              cargando={cargando}
              error={error}
              onAgregar={onAgregar}
              onReintentar={onReintentar}
            />
          )}
        </section>
      )}

      <EtiquetasActivas
        filtros={filtros}
        opcionesFiltro={opcionesFiltro}
        onQuitar={onQuitar}
        refBotonFiltros={refBotonFiltros}
      />
    </>
  );
}
