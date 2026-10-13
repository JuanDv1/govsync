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
 *   - "autocompletado" (BPIN, Contrato): `minCaracteres={3}` y
 *     `maxSugerencias={10}` (ver `limitesDeBusqueda`).
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
 */
import { useEffect, useId, useState } from "react";

import { normalizar, sugerir } from "../../lib/filtros.js";

export default function SelectorConBusqueda({
  etiqueta,
  opciones,
  seleccionados = [],
  onAgregar,
  minCaracteres = 0,
  maxSugerencias,
  placeholder,
  mensajeSinCoincidencias = "Sin coincidencias",
  mensajeSinOpciones = "Sin opciones en este corte",
}) {
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

  let mensajeAyuda = null;
  if (sinOpciones) mensajeAyuda = mensajeSinOpciones;
  else if (mostrarAyudaMinimo)
    mensajeAyuda = `Escriba al menos ${minCaracteres} caracteres`;
  else if (mostrarSinCoincidencias) mensajeAyuda = mensajeSinCoincidencias;

  let anuncio = "";
  if (hayLista) {
    const cantidad = sugerencias.length;
    anuncio = `${cantidad} ${cantidad === 1 ? "sugerencia" : "sugerencias"}`;
  } else if (mostrarSinCoincidencias) {
    anuncio = mensajeSinCoincidencias;
  }

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
    const total = sugerencias.length;

    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        if (!hayLista) {
          setAbierta(true);
          setIndice(0);
        } else {
          setIndice(activo < 0 ? 0 : (activo + 1) % total);
        }
        break;

      case "ArrowUp":
        evento.preventDefault();
        if (!hayLista) {
          setAbierta(true);
          setIndice(total - 1);
        } else {
          setIndice(activo <= 0 ? total - 1 : activo - 1);
        }
        break;

      case "Home":
        if (hayLista) {
          evento.preventDefault();
          setIndice(0);
        }
        break;

      case "End":
        if (hayLista) {
          evento.preventDefault();
          setIndice(total - 1);
        }
        break;

      case "Enter":
        // Siempre preventDefault: dentro de un <form> Enter enviaría el
        // formulario aunque no haya nada que agregar.
        evento.preventDefault();
        if (hayLista && activo >= 0) seleccionar(sugerencias[activo].valor);
        break;

      case "Escape":
        if (abierta) {
          evento.preventDefault();
          setAbierta(false);
          setIndice(-1);
        } else if (texto) {
          evento.preventDefault();
          setTexto("");
        }
        break;

      default:
        break;
    }
  }

  return (
    <div className="relative">
      <label
        htmlFor={idEntrada}
        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
      >
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
        className="w-full rounded-sm border border-gray-300 bg-fondo-input px-3 py-2 text-sm focus:border-azul disabled:cursor-not-allowed disabled:opacity-40"
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
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-sm border border-gray-200 bg-white py-1 shadow-sm"
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
                className={`cursor-pointer whitespace-normal break-words px-3 py-1.5 text-xs ${
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
        <p id={idAyuda} className="mt-1 text-[11px] text-gray-500">
          {mensajeAyuda}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}
