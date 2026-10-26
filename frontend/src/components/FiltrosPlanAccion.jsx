/**
 * Panel de filtros y etiquetas activas del Plan de Acción.
 *
 * TARJETA: [E04-HU02] Filtrar el Plan de Acción (frontend)
 * CRITERIOS: HU02-CA01 (panel con Sector, Indicador, Meta y Estado de cruce),
 * CA02/CA03/CA09 (listas), CA04 (texto de Meta), CA05 (varios valores de un
 * criterio se muestran como etiquetas)
 *
 * PRESENTACIONAL: no filtra ni guarda nada. `PlanAccion.jsx` es dueña del
 * estado (`filtros`, el texto escrito en Meta) y de las opciones; este
 * componente recibe todo por props y avisa con `onAgregar`, `onQuitar`,
 * `onCambiarTextoMeta` y `onAlternarEstado`. Mismo reparto que
 * `FiltrosMatriz.jsx`, que no se reutiliza porque está atado a los seis
 * criterios de la matriz y a su escala compacta (11px): aquí todo va a 14px,
 * con controles de al menos 40px (ver "LEGIBILIDAD" en PlanAccion.jsx).
 *
 * CUATRO CRITERIOS, TRES CONTROLES DISTINTOS
 *   - Sector e Indicador: lista con buscador (`SelectorConBusqueda`, tamaño
 *     "grande"). Elegir una opción la agrega al filtro y se ve como etiqueta.
 *     Indicador es EXACTO (D27): se elige de la lista "código – nombre".
 *   - Meta: texto libre sobre el código o el nombre. Se muestra como etiqueta
 *     solo cuando ya filtra (3 o más caracteres, `busquedaAplicable`).
 *   - Estado de cruce: tres casillas (OR entre las marcadas).
 *
 * DOS PARTES, CON CICLOS DE VIDA DISTINTOS
 *   - Etiquetas activas: SIEMPRE visibles, con el panel cerrado también.
 *   - Panel: el `<section>` siempre existe, con `hidden` cuando está cerrado,
 *     para que `aria-controls` del botón apunte a un elemento real y lo
 *     oculto no sea enfocable. NO lleva clases `grid`/`flex`: la clase de
 *     `display` le ganaría al atributo `hidden`; la grilla va en un `div`
 *     interno.
 *
 * FOCO AL QUITAR UNA ETIQUETA: lo gestiona `shared/ListaEtiquetasFiltro.jsx`
 * (compartida con `FiltrosMatriz.jsx`): al ✕ de la etiqueta siguiente, al de
 * la anterior si era la última, o al botón "Filtros" si no queda ninguna.
 */

import { MINIMO_BUSQUEDA } from "../lib/filtrosPlanAccion.js";
import Campo from "./shared/Campo.jsx";
import ListaEtiquetasFiltro from "./shared/ListaEtiquetasFiltro.jsx";
import SelectorConBusqueda from "./shared/SelectorConBusqueda.jsx";

export default function FiltrosPlanAccion({
  filtros,
  textoMeta,
  opcionesSector,
  opcionesIndicador,
  estadosCruce,
  abierto,
  idPanel,
  refBotonFiltros,
  onAgregar,
  onQuitar,
  onCambiarTextoMeta,
  onAlternarEstado,
}) {
  // Textos de las etiquetas: el indicador muestra "código – nombre" y el
  // estado, su texto de pantalla; si no se encuentra, se cae al valor.
  const textosIndicador = new Map(
    opcionesIndicador.map((opcion) => [opcion.valor, opcion.texto]),
  );
  const textosEstado = new Map(
    estadosCruce.map((estado) => [estado.valor, estado.texto]),
  );

  // Mismo orden que el panel: Sector, Indicador, Meta, Estado de cruce.
  const etiquetas = [
    ...filtros.sector.map((valor) => ({
      clave: "sector",
      titulo: "Sector",
      valor,
      texto: valor,
    })),
    ...filtros.cod_indicador_producto.map((valor) => ({
      clave: "cod_indicador_producto",
      titulo: "Indicador",
      valor,
      texto: textosIndicador.get(valor) ?? valor,
    })),
    ...(filtros.busqueda
      ? [
          {
            clave: "busqueda",
            titulo: "Meta",
            valor: filtros.busqueda,
            texto: `«${filtros.busqueda}»`,
          },
        ]
      : []),
    ...filtros.estado_cruce.map((valor) => ({
      clave: "estado_cruce",
      titulo: "Estado de cruce",
      valor,
      texto: textosEstado.get(valor) ?? valor,
    })),
  ];

  return (
    <>
      <section
        id={idPanel}
        hidden={!abierto}
        aria-label="Filtros del Plan de Acción"
        className="mt-4 border-t border-gray-200 pt-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectorConBusqueda
            tamano="grande"
            etiqueta="Sector"
            opciones={opcionesSector}
            seleccionados={filtros.sector}
            onAgregar={(valor) => onAgregar("sector", valor)}
            placeholder="Escriba para buscar"
          />

          <SelectorConBusqueda
            tamano="grande"
            etiqueta="Indicador"
            opciones={opcionesIndicador}
            seleccionados={filtros.cod_indicador_producto}
            onAgregar={(valor) => onAgregar("cod_indicador_producto", valor)}
            placeholder="Escriba para buscar"
          />

          <Campo
            etiqueta="Meta"
            type="text"
            autoComplete="off"
            ayuda={`Código o parte del nombre (mínimo ${MINIMO_BUSQUEDA} caracteres)`}
            value={textoMeta}
            onChange={(evento) => onCambiarTextoMeta(evento.target.value)}
          />

          <fieldset>
            <legend className="mb-1.5 block text-campo font-medium text-gray-700">
              Estado de cruce
            </legend>
            <div className="flex flex-col">
              {estadosCruce.map((estado) => (
                <label
                  key={estado.valor}
                  className="flex min-h-11 cursor-pointer items-center gap-2.5 text-campo text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={filtros.estado_cruce.includes(estado.valor)}
                    onChange={() => onAlternarEstado(estado.valor)}
                    className="h-5 w-5 accent-azul focus:outline-none focus-visible:ring-2 focus-visible:ring-azul focus-visible:ring-offset-1"
                  />
                  {estado.texto}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <ListaEtiquetasFiltro
        etiquetas={etiquetas}
        onQuitar={onQuitar}
        refBotonFiltros={refBotonFiltros}
      />
    </>
  );
}
