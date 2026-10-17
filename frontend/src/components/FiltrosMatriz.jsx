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
 * FOCO AL QUITAR UNA ETIQUETA: el ✕ pulsado desaparece con su etiqueta, así
 * que el foco se mueve ANTES de avisar al padre, dentro del propio manejador
 * (nada de efectos ni de estado): al ✕ de la etiqueta siguiente, o al de la
 * anterior si era la última, o al botón "Filtros" si no queda ninguna. Las
 * etiquetas llevan una `key` estable (`clave:valor`), así que el ✕ vecino
 * sigue montado después de quitar la etiqueta y no pierde el foco. Todos los
 * destinos están siempre visibles: nunca se enfoca algo del panel cerrado.
 */
import { X } from "lucide-react";
import { useRef } from "react";

import {
  CRITERIOS,
  limitesDeBusqueda,
  opcionesParaCriterio,
} from "../lib/filtros.js";
import { Cargando, EstadoError } from "./Estados.jsx";
import SelectorConBusqueda from "./shared/SelectorConBusqueda.jsx";

//: Estados HTTP cuyo error ya muestra la matriz del mismo corte.
const ESTADOS_QUE_MUESTRA_LA_MATRIZ = new Set([404, 409]);

function EtiquetasActivas({
  filtros,
  opcionesFiltro,
  onQuitar,
  refBotonFiltros,
}) {
  // ✕ montados, por `clave:valor`. Cada ref de callback se auto-limpia al
  // desmontarse la etiqueta, así que nunca se enfoca un nodo que ya no está.
  const botonesQuitar = useRef(new Map());

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
        <li
          key={idDe(etiqueta)}
          className="inline-flex items-center gap-1.5 rounded-sm border border-blue-200 bg-blue-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-azul"
        >
          <span>
            {etiqueta.titulo}: {etiqueta.texto}
          </span>
          <button
            ref={(boton) => {
              if (boton) botonesQuitar.current.set(idDe(etiqueta), boton);
              else botonesQuitar.current.delete(idDe(etiqueta));
            }}
            type="button"
            aria-label={`Quitar filtro ${etiqueta.titulo} ${etiqueta.texto}`}
            onClick={() => quitar(indice)}
            className="rounded-sm p-0.5 text-azul transition-colors hover:bg-blue-100 hover:text-navy"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
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
          className="mt-4 border-t border-gray-100 pt-4"
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
