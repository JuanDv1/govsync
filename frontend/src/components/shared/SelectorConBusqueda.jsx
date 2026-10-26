/**
 * Selector con búsqueda y autocompletado (combobox ARIA 1.2) de selección
 * múltiple "por adición".
 *
 * TARJETA: [E02-HU10] Filtrar la matriz de relación (frontend)
 * CRITERIOS: HU10-CA03 (autocompletar BPIN y Contrato), HU10-CA04 (lista de
 * Indicador con buscador; mismo componente para Producto, Sector y Programa)
 *
 * PATRÓN DE ADICIÓN: este componente NO guarda lo seleccionado. Cada vez que
 * la persona elige una opción llama a `onAgregar(valor)`, vacía el campo y
 * cierra la lista; quien lo usa (el panel de filtros) es dueño de los
 * valores seleccionados y los muestra como etiquetas quitables (HU10-CA10).
 * Aquí `seleccionados` solo sirve para no volver a sugerir lo ya elegido.
 *
 * UN SOLO COMPONENTE PARA LOS DOS MODOS de `lib/filtros.js::CRITERIOS`:
 *   - "autocompletado" (BPIN, Contrato): `minCaracteres` por criterio
 *     (BPIN 3, Contrato 1) y `maxSugerencias={10}` (ver
 *     `limitesDeBusqueda`).
 *   - "lista" (los otros cuatro): los valores por defecto — buscador desde
 *     0 caracteres y sin tope; al enfocar muestra la lista completa.
 * La búsqueda ("contiene", sin distinguir mayúsculas ni guiones) vive en
 * `sugerir`, de `lib/filtros.js`; aquí no se duplica.
 *
 * `opciones` es `[{ valor, texto }]`. Lo que se entrega a `onAgregar` es
 * siempre `valor`, tal cual (el backend compara exacto); nunca se convierte
 * con `Number()`/`parseInt()`.
 *
 * ACCESIBILIDAD (patrón "combobox with listbox popup", sin autoselección):
 * el foco real nunca sale del <input>; la opción activa se anuncia con
 * `aria-activedescendant`. Teclado: ↓/↑ abren y recorren (circular), Inicio/
 * Fin saltan a la primera/última opción, Enter agrega la opción activa (si
 * no hay una activa no hace nada, y nunca envía un formulario padre), Esc
 * cierra la lista y, si ya estaba cerrada, limpia el texto; Tab cierra sin
 * seleccionar. Una región `aria-live` anuncia "N sugerencias" o el mensaje
 * de sin coincidencias.
 *
 * REGLA react-hooks/set-state-in-effect: ningún setState dentro de un
 * efecto. Las sugerencias se derivan durante el render, el índice activo se
 * reinicia en los manejadores (onChange/onFocus/onBlur) y se acota al
 * leerlo. El único efecto toca solo el DOM (`scrollIntoView`).
 *
 * TAMAÑO (`tamano`): "normal" es el que usa el panel de la matriz: etiqueta
 * de 14px, ayuda de 13px y opciones de 12px. "grande" es para el Plan de
 * Acción [E04-HU02]: textos de 14px, campo de al menos 40px de alto, foco
 * visible, y la lista con `z-30` para quedar por encima del encabezado fijo
 * de la tabla (`z-20`). Solo cambian las clases (`TAMANOS`): el
 * comportamiento es el mismo.
 */
import { useEffect, useId, useState } from "react";

import { normalizar, sugerir } from "../../lib/filtros.js";

//: Clases por tamaño (los px suponen la raíz al 100 %, 16 px).
const TAMANOS = {
  normal: {
    etiqueta: "mb-1.5 block text-campo font-medium text-gray-700",
    campo:
      "min-h-11 w-full rounded-control border-[1.5px] border-borde-control bg-white px-3 text-campo focus:border-azul-accion focus:outline-none focus-visible:ring-2 focus-visible:ring-azul-accion disabled:cursor-not-allowed disabled:opacity-40",
    lista:
      "absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-control border border-gray-200 bg-white py-1 shadow-suave",
    opcion:
      "cursor-pointer whitespace-normal break-words px-3 py-1.5 text-campo",
    ayuda: "mt-1 text-ayuda text-gray-600",
  },
  grande: {
    etiqueta: "mb-1.5 block text-campo font-medium text-gray-700",
    campo:
      "min-h-11 w-full rounded-control border-[1.5px] border-borde-control bg-white px-3 text-campo focus:border-azul-accion focus:outline-none focus-visible:ring-2 focus-visible:ring-azul-accion disabled:cursor-not-allowed disabled:opacity-40",
    lista:
      "absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-control border border-gray-200 bg-white py-1 shadow-suave",
    opcion: "cursor-pointer whitespace-normal break-words px-3 py-2 text-campo",
    ayuda: "mt-1 text-campo text-gray-600",
  },
};

function enPlural(cantidad, singular, plural) {
  return cantidad === 1 ? singular : plural;
}

// Texto asociado al campo con `aria-describedby`, o `null` si no hay nada
// que explicar. El orden es el de prioridad.
function textoAyuda({
  sinOpciones,
  mostrarAyudaMinimo,
  mostrarSinCoincidencias,
  minCaracteres,
  mensajeSinOpciones,
  mensajeSinCoincidencias,
}) {
  if (sinOpciones) return mensajeSinOpciones;
  if (mostrarAyudaMinimo) {
    return `Escriba al menos ${minCaracteres} ${enPlural(minCaracteres, "carácter", "caracteres")}`;
  }
  if (mostrarSinCoincidencias) return mensajeSinCoincidencias;
  return null;
}

// Lo que anuncia la región `aria-live`: "N sugerencias" o el mensaje de sin
// coincidencias.
function textoAnuncio({
  hayLista,
  cantidadSugerencias,
  mostrarSinCoincidencias,
  mensajeSinCoincidencias,
}) {
  if (hayLista) {
    return `${cantidadSugerencias} ${enPlural(cantidadSugerencias, "sugerencia", "sugerencias")}`;
  }
  if (mostrarSinCoincidencias) return mensajeSinCoincidencias;
  return "";
}

// ↑/↓ (circulares) e Inicio/Fin: devuelve el nuevo índice activo, y
// `abrir: true` si la lista estaba cerrada, o `null` si la tecla no navega
// (en ese caso no se hace `preventDefault`). ↑/↓ siempre navegan: con la
// lista cerrada la abren en la primera o la última opción. Inicio/Fin solo
// navegan con la lista abierta; si no, mueven el cursor del texto.
function navegarConTeclado(tecla, { activo, total, hayLista }) {
  switch (tecla) {
    case "ArrowDown":
      if (!hayLista) return { indice: 0, abrir: true };
      return { indice: activo < 0 ? 0 : (activo + 1) % total };
    case "ArrowUp":
      if (!hayLista) return { indice: total - 1, abrir: true };
      return { indice: activo <= 0 ? total - 1 : activo - 1 };
    case "Home":
      return hayLista ? { indice: 0 } : null;
    case "End":
      return hayLista ? { indice: total - 1 } : null;
    default:
      return null;
  }
}

export default function SelectorConBusqueda({
  etiqueta,
  opciones,
  seleccionados = [],
  onAgregar,
  minCaracteres = 0,
  maxSugerencias,
  placeholder,
  tamano = "normal",
  mensajeSinCoincidencias = "Sin coincidencias",
  mensajeSinOpciones = "Sin opciones en este corte",
}) {
  const clases = TAMANOS[tamano] ?? TAMANOS.normal;
  const id = useId();
  const idEntrada = `${id}-entrada`;
  const idLista = `${id}-lista`;
  const idAyuda = `${id}-ayuda`;
  const idOpcion = (posicion) => `${id}-opcion-${posicion}`;

  const [texto, setTexto] = useState("");
  const [enfocado, setEnfocado] = useState(false);
  // `abierta` es la intención de la persona (Esc la cierra, ↓ la abre); lo
  // que realmente se ve además depende del foco y de los datos.
  const [abierta, setAbierta] = useState(false);
  // -1 = ninguna opción activa. Se acota al leerlo (ver `activo`).
  const [indice, setIndice] = useState(-1);

  const sinOpciones = !opciones || opciones.length === 0;
  const cumpleMinimo = normalizar(texto).trim().length >= minCaracteres;
  const sugerencias = sugerir(opciones ?? [], texto, {
    minimo: minCaracteres,
    maximo: maxSugerencias,
    excluir: seleccionados,
  });

  const activa = enfocado && abierta && !sinOpciones;
  const hayLista = activa && sugerencias.length > 0;
  const mostrarAyudaMinimo = activa && !cumpleMinimo;
  const mostrarSinCoincidencias =
    activa && cumpleMinimo && sugerencias.length === 0;

  const activo = hayLista ? Math.min(indice, sugerencias.length - 1) : -1;
  const idActivo = activo >= 0 ? idOpcion(activo) : undefined;

  const mensajeAyuda = textoAyuda({
    sinOpciones,
    mostrarAyudaMinimo,
    mostrarSinCoincidencias,
    minCaracteres,
    mensajeSinOpciones,
    mensajeSinCoincidencias,
  });
  const anuncio = textoAnuncio({
    hayLista,
    cantidadSugerencias: sugerencias.length,
    mostrarSinCoincidencias,
    mensajeSinCoincidencias,
  });

  // Mantiene la opción activa dentro del área visible de la lista. Solo
  // toca el DOM: ningún setState aquí.
  useEffect(() => {
    if (!idActivo) return;
    document.getElementById(idActivo)?.scrollIntoView?.({ block: "nearest" });
  }, [idActivo]);

  function seleccionar(valor) {
    onAgregar(valor);
    setTexto("");
    setIndice(-1);
    setAbierta(false);
  }

  function alCambiarTexto(evento) {
    setTexto(evento.target.value);
    setAbierta(true);
    setIndice(-1);
  }

  function alEnfocar() {
    setEnfocado(true);
    setAbierta(true);
    setIndice(-1);
  }

  function alPerderFoco() {
    setEnfocado(false);
    setAbierta(false);
    setIndice(-1);
  }

  function alPresionarTecla(evento) {
    const paso = navegarConTeclado(evento.key, {
      activo,
      total: sugerencias.length,
      hayLista,
    });
    if (paso) {
      evento.preventDefault();
      if (paso.abrir) setAbierta(true);
      setIndice(paso.indice);
      return;
    }

    if (evento.key === "Enter") {
      // Siempre preventDefault: dentro de un <form> Enter enviaría el
      // formulario aunque no haya nada que agregar.
      evento.preventDefault();
      if (hayLista && activo >= 0) seleccionar(sugerencias[activo].valor);
      return;
    }

    if (evento.key !== "Escape") return;
    // Esc cierra la lista; si ya estaba cerrada, limpia el texto.
    if (abierta) {
      evento.preventDefault();
      setAbierta(false);
      setIndice(-1);
    } else if (texto) {
      evento.preventDefault();
      setTexto("");
    }
  }

  return (
    <div className="relative">
      <label htmlFor={idEntrada} className={clases.etiqueta}>
        {etiqueta}
      </label>

      <input
        id={idEntrada}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={hayLista}
        aria-controls={hayLista ? idLista : undefined}
        aria-activedescendant={idActivo}
        aria-describedby={mensajeAyuda ? idAyuda : undefined}
        autoComplete="off"
        disabled={sinOpciones}
        placeholder={placeholder}
        value={texto}
        onChange={alCambiarTexto}
        onFocus={alEnfocar}
        onBlur={alPerderFoco}
        onKeyDown={alPresionarTecla}
        className={clases.campo}
      />

      {hayLista && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={etiqueta}
          // preventDefault en el listbox (no en cada opción) evita que el
          // input pierda el foco —y que `alPerderFoco` cierre la lista— al
          // pulsar una opción o la barra de scroll, antes de que llegue el
          // clic.
          onMouseDown={(evento) => evento.preventDefault()}
          className={clases.lista}
        >
          {sugerencias.map((opcion, posicion) => {
            const esActiva = posicion === activo;
            return (
              <li
                key={`${opcion.valor}-${posicion}`}
                id={idOpcion(posicion)}
                role="option"
                aria-selected={esActiva}
                onClick={() => seleccionar(opcion.valor)}
                className={`${clases.opcion} ${
                  esActiva
                    ? "bg-secundario text-navy"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {opcion.texto}
              </li>
            );
          })}
        </ul>
      )}

      {mensajeAyuda && (
        <p id={idAyuda} className={clases.ayuda}>
          {mensajeAyuda}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}
