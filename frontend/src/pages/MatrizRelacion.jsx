/**
 * Matriz de relación del corte.
 *
 * TARJETAS: [HU-07][FE-02] Tabla de la matriz de relación
 *           [HU-07][FE-03] Representación explícita de la información no relacionada
 *           [HU-07][FE-04] Integración y rendimiento de la tabla
 *           [E02-HU10] Filtros de la matriz (panel, etiquetas activas);
 *           ver `components/FiltrosMatriz.jsx` y `lib/filtros.js`
 *
 * ALCANCE DE FE-02 (CA-3 a CA-6): tabla con las seis columnas confirmadas
 * (código BPIN, indicador y/o producto, ejecución, contrato).
 *
 * CORRECCIÓN DE CONTRATO (2026-09-19, actualizada 2026-09-21): esta nota
 * decía que el backend envía las columnas junto con los datos. No es así:
 * `GET /matriz-relacion/{id}` (`trazabilidad/api/router.py::MatrizRespuesta`)
 * solo devuelve `filas`. El router llegó a tener una constante `COLUMNAS`
 * pensada para centralizar este contrato, pero nunca se usó (código muerto)
 * y se borró el 2026-09-21 (ver docs/archivo/sprint-1/TRAZABILIDAD.md). Los encabezados de
 * abajo quedan fijos en este archivo, en el mismo orden y claves que el
 * contrato confirmado en HU-07/CA-3..CA-6. Si el backend llega a exponer
 * `columnas` en la respuesta, este archivo debe pasar a consumirla en vez
 * de mantener su propia copia.
 *
 * TRES COSAS QUE NO SE PUEDEN PERDER EN ESTA PANTALLA
 *
 * 1. Lo que no se pudo relacionar viaja como `null` desde el backend (NULL
 *    explícito, nunca una celda vacía ambigua ni un "N/A" inventado).
 *    [HU-07][FE-03] representa esas celdas mediante `SinCorrespondencia`,
 *    sin inventar asociaciones ni motivos que el backend no entrega.
 *
 * 2. Las relaciones múltiples no se agrupan ni se colapsan en frontend:
 *    cada elemento de `matriz.filas` se renderiza como una fila independiente,
 *    preservando el resultado entregado por el backend (CA-7).
 *
 * 3. Los códigos se muestran con la clase `.codigo` (monoespaciada): es lo
 *    que hace visible el cero a la izquierda de 040110500. Nunca `Number()`
 *    ni `parseInt()` sobre `cod_bpin`, `cod_indicador_producto` ni
 *    `cod_indicador_ejecucion`.
 *
 * ALCANCE DE FE-04 (tarjeta Trello, sin CA propio en
 * docs/archivo/sprint-1/PLANDETRABAJO.md —
 * ver docs/archivo/sprint-1/TRAZABILIDAD.md/CA-1 para la evidencia; CA-2 es un contrato
 * puramente de backend, "usa información ya procesada, no relee Excel", y
 * no tiene una contraparte de UI, así que esta tarjeta no le agrega nada
 * nuevo salvo la etiqueta heredada del Trello):
 *
 * - Consumo REAL de la paginación de `GET /matriz-relacion/{corte_id}` (ya
 *   soportada por `api.matriz(corteId, pagina, tamanoPagina)` desde
 *   [HU-07][FE-01]/[FE-02], pero nunca invocada con una página distinta de
 *   la 1). Antes de esta tarjeta la pantalla solo podía mostrar la primera
 *   página del corte; ahora navega todas las páginas que reporte el backend
 *   (`total_filas` / `tamano_pagina`).
 * - DECISIÓN TÉCNICA (paginación visible vs. virtualización — la tarjeta
 *   acepta cualquiera de las dos): se eligió PAGINACIÓN VISIBLE con
 *   controles "Anterior/Siguiente", no virtualización (p. ej. react-window).
 *   Motivo: el corte de referencia real (docs/DECISIONES.md D4) tiene 144
 *   metas; incluso con el fan-out de CA-7 (una meta con varios BPIN/
 *   contratos genera varias filas) el volumen esperado sigue siendo de
 *   cientos de filas por corte, no decenas de miles. Traer una librería de
 *   virtualización para ese volumen sería sofisticación técnica sin
 *   beneficio medible (la paginación de 50 filas por página, que ya existe
 *   en el backend, ya evita renderizar miles de filas de golpe) y añadiría
 *   una dependencia nueva al frontend. Si el volumen real de producción
 *   creciera en órdenes de magnitud, esta decisión debe revisarse — no es
 *   definitiva, es la que mejor cumple CORRECCIÓN FUNCIONAL + MANTENIBILIDAD
 *   con el dato de volumen confirmado hoy.
 * - "Evitar re-renderizados completos al cambiar de página": la tabla y los
 *   controles de paginación permanecen montados durante el cambio de
 *   página — `matrizVisible` conserva los datos de la última página cargada
 *   con éxito y solo se reemplaza cuando la petición siguiente resuelve. La
 *   pantalla completa de `Cargando` (que sí reemplaza toda la sección) solo
 *   aparece en la carga inicial del corte, cuando todavía no hay ninguna
 *   fila que mostrar.
 * - Sin framework de pruebas automatizadas de frontend en el repo (ver
 *   `frontend/package.json` — no hay vitest/jest/@testing-library ni script
 *   `test`). Mismo precedente que CA-3..CA-8 de esta misma pantalla
 *   (docs/archivo/sprint-1/TRAZABILIDAD.md): validación manual en navegador contra el
 *   backend real, con el corte de referencia de docs/DECISIONES.md D4.
 *   Agregar infraestructura de pruebas de frontend es una decisión de
 *   arquitectura propia que el equipo debe tomar explícitamente en una
 *   tarjeta dedicada — no se introduce aquí de forma silenciosa.
 */
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api/cliente.js";
import {
  Cargando,
  EstadoError,
  SinCorrespondencia,
  Vacio,
} from "../components/Estados.jsx";
import FiltrosMatriz from "../components/FiltrosMatriz.jsx";
import Card from "../components/shared/Card.jsx";
import StateBadge from "../components/shared/StateBadge.jsx";
import {
  FILTROS_VACIOS,
  agregarValor,
  contarActivos,
  hayFiltros,
  quitarValor,
} from "../lib/filtros.js";
import { cop } from "../lib/formato.js";

//: Mismo orden y claves que el contrato confirmado en HU-07/CA-3..CA-6 — ver
//: la nota de corrección de contrato arriba (la constante `COLUMNAS` del
//: router era código muerto y se borró el 2026-09-21). `presupuesto_apropiado`
//: se agregó 2026-09-23 (D22, docs/DECISIONES.md): un solo monto general
//: ("algo de presupuesto pero no tan detallado, lo general"), no las cinco
//: columnas financieras de `Rubro` — para eso está la tabla `rubro` en la
//: base de datos, no esta pantalla de verificación visual del cruce.
//: `nombre_proyecto` (E02-HU10/CA17): la fila muestra el nombre del proyecto,
//: no solo el código BPIN; llega en `FilaMatrizRespuesta` del backend.
const COLUMNAS = [
  { clave: "cod_bpin", titulo: "Cód. BPIN" },
  { clave: "nombre_proyecto", titulo: "Nombre del proyecto" },
  { clave: "cod_indicador_producto", titulo: "Cód. indicador (SisPT)" },
  { clave: "nombre_producto", titulo: "Nombre del producto" },
  { clave: "cod_indicador_ejecucion", titulo: "Cód. indicador (ejecución)" },
  { clave: "numero_contrato", titulo: "Núm. contrato" },
  { clave: "descripcion_contrato", titulo: "Descripción" },
  { clave: "presupuesto_apropiado", titulo: "Presupuesto" },
];

const CLAVES_CODIGO = new Set([
  "cod_bpin",
  "cod_indicador_producto",
  "cod_indicador_ejecucion",
]);

// [HU-07][FE-04] Mismo tamaño de página que el valor por defecto del backend
// (`obtener_matriz`/`obtener_matriz_actual`, `tamano_pagina: int = 50`). No
// se expone un selector de tamaño de página: la tarjeta pide navegar el
// volumen real sin renderizar miles de filas de golpe, no elegir cuántas
// filas por página — agregar ese control sería alcance no pedido.
const TAMANO_PAGINA = 50;

//: Opciones del filtro "Estado del cruce" (D22) — mismos valores que
//: `trazabilidad/persistence/consultas.py::_construir_consulta_base` espera
//: en `estado_cruce`. `""` significa "sin filtrar" (todas).
const OPCIONES_ESTADO_CRUCE = [
  { valor: "", etiqueta: "Todas" },
  { valor: "completo", etiqueta: "Completo (BPIN + ejecución + contrato)" },
  { valor: "sin_proyecto", etiqueta: "Sin proyecto BPIN" },
  { valor: "sin_ejecucion", etiqueta: "Sin ejecución" },
  { valor: "sin_contrato", etiqueta: "Sin contrato" },
  { valor: "sin_cruce", etiqueta: "Sin ningún cruce" },
];

// [E02-HU10/CA02/CA12] Mismo texto en el contador de la Card y en la
// paginación: "1 registro" / "N registros". [ASUMIDO, pendiente PO]
function textoRegistros(total) {
  return `${total} ${total === 1 ? "registro" : "registros"}`;
}

function Celda({ clave, valor }) {
  if (valor === null || valor === undefined) {
    return <SinCorrespondencia />;
  }
  if (clave === "presupuesto_apropiado") {
    return <span className="font-mono">{cop(valor)}</span>;
  }
  return CLAVES_CODIGO.has(clave) ? (
    <span className="codigo">{valor}</span>
  ) : (
    valor
  );
}

// D22: resume visualmente si la meta cruzó con las tres fuentes, con
// ninguna, o solo con algunas — para que verificar el cruce no dependa de
// leer las tres columnas de correspondencia una por una en cada fila.
function estadoDeFila(fila) {
  const cuantos = [
    fila.cod_bpin,
    fila.cod_indicador_ejecucion,
    fila.numero_contrato,
  ].filter((valor) => valor !== null && valor !== undefined).length;
  if (cuantos === 3) return { texto: "Completo", tono: "verde" };
  if (cuantos === 0) return { texto: "Sin cruce", tono: "gris" };
  return { texto: "Parcial", tono: "ambar" };
}

// [HU-07][FE-04] Controles de paginación. Deliberadamente sin lógica de
// negocio: solo recibe los números ya calculados por el componente padre y
// dispara `onCambiarPagina`. `aria-live="polite"` en el indicador de página
// para que un lector de pantalla anuncie el cambio sin interrumpir.
function PaginacionMatriz({
  pagina,
  totalPaginas,
  totalFilas,
  actualizando,
  onCambiarPagina,
}) {
  return (
    <nav
      className="mt-3 flex items-center justify-center gap-4"
      aria-label="Paginación de la matriz de relación"
    >
      <button
        type="button"
        onClick={() => onCambiarPagina(pagina - 1)}
        disabled={pagina <= 1 || actualizando}
        className="rounded-sm border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>

      {/* [E02-HU10] El total ya lo anuncia el contador de la Card (su propia
          región live): aquí solo se anuncian la página y "actualizando…". El
          total queda visible, fuera de las regiones live, en el mismo orden
          de siempre. Las dos regiones están siempre montadas (una región que
          se monta ya con texto no se anuncia). */}
      <span className="text-[11px] text-gray-500">
        <span aria-live="polite">
          Página {pagina} de {totalPaginas}
        </span>
        {` · ${textoRegistros(totalFilas)} en total`}
        <span aria-live="polite">{actualizando ? " · actualizando…" : ""}</span>
      </span>

      <button
        type="button"
        onClick={() => onCambiarPagina(pagina + 1)}
        disabled={pagina >= totalPaginas || actualizando}
        className="rounded-sm border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Siguiente
      </button>
    </nav>
  );
}

export default function MatrizRelacion() {
  const { corteId } = useParams();
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  // `clave` identifica a qué petición pertenece `datos`/`error`: mientras no
  // coincida con `claveActual`, la petición sigue en curso. Evita reiniciar
  // el estado con un setState síncrono al inicio del efecto (ver
  // react-hooks/set-state-in-effect) — el único setState de este efecto
  // ocurre dentro de los callbacks de la promesa.
  const [resultado, setResultado] = useState({
    clave: null,
    datos: null,
    error: null,
  });
  // [HU-07][FE-04] Últimos datos mostrados con éxito para el `corteId`
  // actual. Se conserva mientras se carga la página siguiente para que la
  // tabla no desaparezca ni se desmonte en cada cambio de página — solo se
  // reemplaza cuando la nueva petición resuelve, o se limpia al cambiar de
  // corte.
  const [matrizVisible, setMatrizVisible] = useState(null);

  // D22 (docs/DECISIONES.md): filtros de la matriz. `busquedaInput` es lo
  // que el usuario escribe; `busqueda` es lo que realmente se manda al
  // backend, con un pequeño debounce (ver efecto de abajo) para no disparar
  // una petición por cada tecla.
  const [estadoCruce, setEstadoCruce] = useState("");
  const [busquedaInput, setBusquedaInput] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // [E02-HU10] Filtros estructurados (BPIN, Indicador, Producto, Contrato,
  // Sector, Programa): `{ <clave de query param>: [valores] }`, ver
  // `lib/filtros.js`. Viven en estado local, no en la URL — mismo criterio
  // que `estadoCruce`/`busqueda`, y el reset por corte de abajo ya cubre
  // "al cambiar de corte se limpian" (HU10-CA13). Se aplican al seleccionar,
  // sin botón "Aplicar". `pagina` NO se toca al paginar, así que los filtros
  // se mantienen entre páginas.
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const idPanel = useId();
  // Botón "Filtros": destino del foco cuando se quita la última etiqueta o
  // se pulsa "Limpiar filtros" (ver `FiltrosMatriz` y `limpiarFiltros`).
  const refBotonFiltros = useRef(null);

  // [E02-HU10] Opciones de filtro del corte: mismo patrón `{clave, datos,
  // error}` que `resultado` (la clave identifica de qué corte/intento es lo
  // guardado; si no coincide con `claveOpciones`, sigue cargando o son datos
  // de otro corte y se ignoran). `intentoOpciones` es el "Reintentar".
  const [intentoOpciones, setIntentoOpciones] = useState(0);
  const [resultadoOpciones, setResultadoOpciones] = useState({
    clave: null,
    datos: null,
    error: null,
  });

  // Cambiar de corte es una pantalla distinta: se reinicia la página, los
  // filtros, y se descartan las filas que se estaban mostrando (pertenecen
  // al corte anterior, no tiene sentido conservarlas como "página previa"
  // de otro corte). Ajustar estado cuando cambia una prop se hace DURANTE
  // el render (patrón oficial de React: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
  // no dentro de un efecto — evita el re-render en cascada que marca
  // react-hooks/set-state-in-effect, y evita el parpadeo de un render con
  // datos del corte anterior antes de que el efecto de abajo llegue a
  // limpiarlos.
  const [corteAnterior, setCorteAnterior] = useState(corteId);
  if (corteId !== corteAnterior) {
    setCorteAnterior(corteId);
    setPagina(1);
    setMatrizVisible(null);
    setEstadoCruce("");
    setBusquedaInput("");
    setBusqueda("");
    setFiltros(FILTROS_VACIOS);
    setPanelAbierto(false);
  }

  // Debounce de la búsqueda: espera a que el usuario deje de escribir antes
  // de mandar la petición. Reinicia la página a 1 — un resultado filtrado
  // nuevo no tiene por qué tener tantas páginas como el histórico completo.
  useEffect(() => {
    const id = setTimeout(() => {
      setBusqueda(busquedaInput.trim());
      setPagina(1);
    }, 400);
    return () => clearTimeout(id);
  }, [busquedaInput]);

  function cambiarEstadoCruce(nuevo) {
    setEstadoCruce(nuevo);
    setPagina(1);
  }

  // [E02-HU10] Cualquier cambio de filtro vuelve a la página 1, igual que
  // `cambiarEstadoCruce`: un resultado filtrado nuevo no tiene por qué tener
  // tantas páginas como el anterior. Funcional (`anteriores`) para no leer un
  // `filtros` viejo si llegan dos cambios seguidos.
  function agregarFiltro(clave, valor) {
    setFiltros((anteriores) => agregarValor(anteriores, clave, valor));
    setPagina(1);
  }

  function quitarFiltro(clave, valor) {
    setFiltros((anteriores) => quitarValor(anteriores, clave, valor));
    setPagina(1);
  }

  // [E02-HU10/CA12] Vuelve a mostrar todos los registros del corte: vacía los
  // 6 criterios Y también el estado del cruce y la búsqueda, todo en el MISMO
  // manejador (un solo render, una sola petición). Se vacía `busquedaInput`
  // además de `busqueda`: así el debounce de arriba, que se reprograma al
  // cambiar `busquedaInput`, solo reescribe valores que ya son iguales (sin
  // re-render) en vez de disparar una segunda petición. El foco pasa a
  // "Filtros" porque este botón desaparece al limpiar; se hace aquí, en el
  // manejador, no en un efecto.
  function limpiarFiltros() {
    // Si ya no hay criterios se conserva el mismo objeto: un objeto vacío
    // "nuevo" cambiaría la identidad de `filtros` y re-dispararía el efecto.
    setFiltros((anteriores) =>
      hayFiltros(anteriores) ? FILTROS_VACIOS : anteriores,
    );
    setEstadoCruce("");
    setBusquedaInput("");
    setBusqueda("");
    setPagina(1);
    refBotonFiltros.current?.focus();
  }

  const claveActual = corteId
    ? `${corteId}:${pagina}:${intento}:${estadoCruce}:${busqueda}:${JSON.stringify(filtros)}`
    : null;

  useEffect(() => {
    if (!corteId) return;

    const clave = `${corteId}:${pagina}:${intento}:${estadoCruce}:${busqueda}:${JSON.stringify(filtros)}`;
    let vigente = true;

    api
      .matriz(
        corteId,
        pagina,
        TAMANO_PAGINA,
        estadoCruce || null,
        busqueda || null,
        filtros,
      )
      .then((datos) => {
        if (!vigente) return;
        setResultado({ clave, datos, error: null });
        setMatrizVisible(datos);
      })
      .catch((errorApi) => {
        if (!vigente) return;
        setResultado({ clave, datos: null, error: errorApi });
      });

    return () => {
      vigente = false;
    };
  }, [corteId, pagina, intento, estadoCruce, busqueda, filtros]);

  const cargando = Boolean(claveActual) && resultado.clave !== claveActual;
  const error = resultado.clave === claveActual ? resultado.error : null;

  // [E02-HU10] Opciones del corte: se piden al montar el corte (no al abrir
  // el panel) para que el texto de las etiquetas y el autocompletado ya
  // tengan datos. Solo hay setState dentro de los callbacks de la promesa.
  const claveOpciones = corteId ? `${corteId}:${intentoOpciones}` : null;

  useEffect(() => {
    if (!corteId) return;

    const clave = `${corteId}:${intentoOpciones}`;
    let vigente = true;

    api
      .opcionesFiltro(corteId)
      .then((datos) => {
        if (!vigente) return;
        setResultadoOpciones({ clave, datos, error: null });
      })
      .catch((errorApi) => {
        if (!vigente) return;
        setResultadoOpciones({ clave, datos: null, error: errorApi });
      });

    return () => {
      vigente = false;
    };
  }, [corteId, intentoOpciones]);

  const opcionesVigentes = resultadoOpciones.clave === claveOpciones;
  const cargandoOpciones = Boolean(claveOpciones) && !opcionesVigentes;
  const opcionesFiltro = opcionesVigentes ? resultadoOpciones.datos : null;
  const errorOpciones = opcionesVigentes ? resultadoOpciones.error : null;
  const reintentarOpciones = useCallback(
    () => setIntentoOpciones((n) => n + 1),
    [],
  );

  const filtrosActivos = contarActivos(filtros);

  // Carga inicial: todavía no hay ninguna fila que mostrar, así que la
  // pantalla completa de `Cargando` es aceptable (no hay nada montado que
  // preservar). Carga de página siguiente: ya hay `matrizVisible`, así que
  // la tabla se mantiene montada y solo se deshabilitan los controles.
  const cargandoInicial = cargando && matrizVisible === null;
  const actualizandoPagina = cargando && matrizVisible !== null;

  // [E02-HU10] El botón "Filtros" (y el panel) solo existen con la matriz ya
  // cargada o con una página previa visible: ni durante la carga inicial
  // (evita que aparezca y desaparezca) ni si la primera carga falló (no hay
  // nada que filtrar y el error ya ocupa la pantalla).
  const puedeFiltrar = !cargandoInicial && !(error && matrizVisible === null);

  // [E02-HU10/CA12] "Limpiar filtros" solo se ofrece si hay algo que limpiar.
  // `busqueda` (la ya enviada al backend), no `busquedaInput`.
  const hayAlgoQueLimpiar =
    hayFiltros(filtros) || Boolean(estadoCruce) || Boolean(busqueda);

  // [E02-HU10/CA11] Se está mostrando el estado "sin resultados" con su
  // propio botón "Limpiar filtros". Decide ese Vacio y, negada, el botón de
  // la Card: así nunca hay dos botones con el mismo nombre accesible a la vez.
  const mostrarSinResultados =
    !cargandoInicial &&
    matrizVisible !== null &&
    matrizVisible.total_filas === 0 &&
    !error &&
    !actualizandoPagina &&
    hayAlgoQueLimpiar;

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  const cambiarPagina = useCallback((nueva) => setPagina(nueva), []);

  const totalPaginas = matrizVisible
    ? Math.max(
        1,
        Math.ceil(matrizVisible.total_filas / matrizVisible.tamano_pagina),
      )
    : 1;

  return (
    <section className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="text-base font-semibold text-gray-800">
          Matriz de relación
        </h1>
        {corteId && (
          <p className="mt-0.5 text-[11px] text-gray-500">
            Corte <span className="font-mono">{corteId}</span>
          </p>
        )}
      </header>

      {!corteId && (
        <Vacio
          titulo="Ningún corte seleccionado"
          descripcion="Elige un corte desde el histórico para ver su matriz de relación."
        />
      )}

      {corteId && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="estado-cruce"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
              >
                Estado del cruce
              </label>
              <select
                id="estado-cruce"
                value={estadoCruce}
                onChange={(evento) => cambiarEstadoCruce(evento.target.value)}
                className="rounded-sm border border-gray-300 bg-fondo-input px-3 py-2 text-sm focus:border-azul focus:outline-none"
              >
                {OPCIONES_ESTADO_CRUCE.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[220px] flex-1">
              <label
                htmlFor="busqueda-matriz"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
              >
                Buscar
              </label>
              <input
                id="busqueda-matriz"
                type="text"
                placeholder="Código de indicador, BPIN o número de contrato"
                value={busquedaInput}
                onChange={(evento) => setBusquedaInput(evento.target.value)}
                className="w-full rounded-sm border border-gray-300 bg-fondo-input px-3 py-2 text-sm focus:border-azul focus:outline-none"
              />
            </div>

            {puedeFiltrar && (
              <button
                ref={refBotonFiltros}
                type="button"
                aria-expanded={panelAbierto}
                aria-controls={idPanel}
                onClick={() => setPanelAbierto((abierto) => !abierto)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ""}
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={panelAbierto ? "rotate-180" : ""}
                />
              </button>
            )}

            {hayAlgoQueLimpiar && !mostrarSinResultados && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="rounded-sm px-2 py-2 text-sm font-medium text-azul transition-colors hover:text-navy"
              >
                Limpiar filtros
              </button>
            )}

            {/* [E02-HU10/CA02/CA12] La región live existe SIEMPRE: una región
                que se monta ya con el texto no se anuncia. Mientras carga,
                `matrizVisible` conserva el total anterior, así que no hay
                anuncio hasta que llega el nuevo. */}
            <div
              aria-live="polite"
              aria-atomic="true"
              className="ml-auto shrink-0 text-[11px] text-gray-500"
            >
              {matrizVisible ? textoRegistros(matrizVisible.total_filas) : ""}
            </div>
          </div>

          <FiltrosMatriz
            filtros={filtros}
            opcionesFiltro={opcionesFiltro}
            cargando={cargandoOpciones}
            error={errorOpciones}
            onAgregar={agregarFiltro}
            onQuitar={quitarFiltro}
            onReintentar={reintentarOpciones}
            abierto={panelAbierto && puedeFiltrar}
            idPanel={idPanel}
            refBotonFiltros={refBotonFiltros}
          />
        </Card>
      )}

      {corteId && cargandoInicial && (
        <Cargando mensaje="Cargando matriz de relación…" />
      )}

      {/* Error sin datos previos que mostrar (falló la carga inicial, o un
          reintento sobre una página que nunca había cargado con éxito). */}
      {corteId && !cargandoInicial && error && matrizVisible === null && (
        <EstadoError error={error} onReintentar={reintentar} />
      )}

      {corteId &&
        !cargandoInicial &&
        matrizVisible !== null &&
        matrizVisible.total_filas === 0 &&
        (error ? (
          // La petición actual falló y lo último mostrado tenía 0 filas: se
          // muestra el error (no el "Vacio" de ese resultado viejo, que lo
          // escondería). Mismo componente y "Reintentar" que con filas.
          <EstadoError error={error} onReintentar={reintentar} />
        ) : actualizandoPagina ? (
          // `hayAlgoQueLimpiar` ya refleja el cambio en curso (p. ej. tras
          // "Limpiar filtros") pero `matrizVisible` sigue siendo el resultado
          // vacío anterior: sin esto se vería un instante el mensaje de
          // "corte sin metas" mientras llega la respuesta.
          <Cargando mensaje="Actualizando matriz de relación…" />
        ) : mostrarSinResultados ? (
          // [E02-HU10/CA11] Mismo manejador que el botón de la Card, que no
          // se pinta mientras se ve este.
          <Vacio
            titulo="No hay registros que cumplan los filtros seleccionados"
            accion={
              <button
                type="button"
                onClick={limpiarFiltros}
                className="rounded-sm px-2 py-2 text-sm font-medium text-azul transition-colors hover:text-navy"
              >
                Limpiar filtros
              </button>
            }
          />
        ) : (
          <Vacio
            titulo="Sin datos para mostrar"
            descripcion="Este corte no tiene metas registradas en la matriz de relación."
          />
        ))}

      {corteId && matrizVisible && matrizVisible.total_filas > 0 && (
        <>
          <Card padding="p-0" className="max-h-[70vh] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {COLUMNAS.map((columna) => (
                    <th
                      key={columna.clave}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {columna.titulo}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrizVisible.filas.map((fila, indice) => {
                  const estado = estadoDeFila(fila);
                  return (
                    <tr
                      key={`${fila.cod_indicador_producto}-${indice}`}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                    >
                      {COLUMNAS.map((columna) => (
                        <td key={columna.clave} className="px-4 py-2.5 text-xs">
                          <Celda
                            clave={columna.clave}
                            valor={fila[columna.clave]}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <StateBadge texto={estado.texto} tono={estado.tono} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* `pagina` (el estado, no `matrizVisible.pagina`) es la página
              que el usuario está pidiendo ahora mismo. Si una página falla,
              deben coincidir para que "Reintentar" y volver a pulsar
              "Siguiente" apunten al mismo número — usar
              `matrizVisible.pagina` (la última que cargó con éxito) dejaría
              "Siguiente" sin efecto tras un error, al pedir de nuevo el
              mismo número ya establecido en el estado. */}
          <PaginacionMatriz
            pagina={pagina}
            totalPaginas={totalPaginas}
            totalFilas={matrizVisible.total_filas}
            actualizando={actualizandoPagina}
            onCambiarPagina={cambiarPagina}
          />

          {/* Error al cambiar de página: no se pierde la tabla ya mostrada
              (matrizVisible sigue siendo la última página cargada con
              éxito). Se informa el error puntual y se ofrece reintentar la
              misma página, sin desmontar el resto de la pantalla. */}
          {error && matrizVisible !== null && (
            <EstadoError error={error} onReintentar={reintentar} />
          )}
        </>
      )}
    </section>
  );
}
