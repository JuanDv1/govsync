/**
 * Comparación del Plan de Acción entre dos cortes de una misma vigencia.
 *
 * TARJETA: [E04-HU04] Comparar dos cortes de una misma vigencia
 * ESPECIFICACIÓN: docs/specs/E04-HU04-comparar-cortes.md (Borrador: manda la
 * hoja HU_E04_04 del Excel) y D29.
 * CONTRATO: `api.cortesDisponibles`, `api.compararCortes` y
 * `api.exportarComparacion` (api/cliente.js).
 *
 * RUTA: `/plan-accion/comparar?vigencia=N`, dentro de `RutaConPlanAccion`
 * (solo `administrador` y `visitante`). La vigencia llega en la URL desde el
 * botón "Comparar cortes" del Plan de Acción; sin ella no hay qué comparar.
 *
 * SELECTORES (CA02, CA03): dos `<select>` nativos rotulados de forma neutra
 * ("Primer corte", "Segundo corte"); el corte elegido en uno queda
 * deshabilitado en el otro. No hay preselección: mientras falte uno se ve
 * "Elija dos cortes para comparar". Con los dos elegidos se compara solo. El
 * backend decide cuál es "Corte A" (el más antiguo) y cuál "Corte B" (D29), así
 * que los rótulos A/B salen de la respuesta, no del orden de los selectores.
 * Dos cortes de una vigencia nunca tienen la misma fecha (índice único
 * `ux_corte_vigencia_fecha`, D9): las opciones no se pueden confundir.
 *
 * DELTA (CA05): Δ = Corte B − Corte A, calculado por el backend. En pantalla
 * la columna se llama "Cambio" (el símbolo Δ no se entendía), y bajo "A" y
 * "B" va la fecha corta de cada corte (DD/MM). Verde con flecha arriba si
 * sube, rojo con flecha abajo si baja, gris si no cambia: el sentido sale del
 * valor real (`sentidoDelta`), nunca solo del color. "—"
 * cuando no es comparable: meta en un solo corte (CA06, insignia "Solo en
 * Corte A/B") o sin dato en uno de los dos. "% Avance físico" es siempre "—"
 * (E-03 sin implementar).
 *
 * SOLO CAMBIOS (CA07): filtro de backend (`solo_cambios=true`, D29). Se
 * conservan los cortes elegidos y, mientras llega la respuesta, la tabla
 * anterior sigue montada con `aria-busy` ("Actualizando…") en vez de
 * desaparecer.
 *
 * PATRÓN DE CARGA: igual que `PlanAccion.jsx`/`MatrizRelacion.jsx`, cada
 * petición tiene una `clave`; lo guardado vale solo si su clave coincide con la
 * actual, y el único setState de cada efecto ocurre dentro de los callbacks de
 * la promesa (regla react-hooks/set-state-in-effect).
 *
 * DEUDA: las clases de la tabla (encabezados, celdas, columnas fijas) son
 * copia de las de `PlanAccion.jsx`, que no las exporta.
 */
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/cliente.js";
import BotonExportarExcel from "../components/BotonExportarExcel.jsx";
import { Cargando, EstadoError, Vacio } from "../components/Estados.jsx";
import Card from "../components/shared/Card.jsx";
import StateBadge from "../components/shared/StateBadge.jsx";
import {
  consultaComparacion,
  mensajeErrorComparacion,
  mensajeErrorExportarComparacion,
  nombreArchivoComparacion,
  sentidoDelta,
} from "../lib/comparacion.js";
import {
  cop,
  copConSigno,
  fechaCorte,
  pct,
  ppConSigno,
} from "../lib/formato.js";

//: Clases de encabezado y celda (copia de `PlanAccion.jsx`). Los bordes van
//: en cada celda porque la tabla es `border-separate` (columnas fijas).
//: `TH_BASE` no lleva fondo: la columna "Cambio" pone el suyo sin que dos
//: clases `bg-*` dependan del orden del CSS.
const TH_BASE =
  "whitespace-nowrap border-b border-gray-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600";
const TH = `${TH_BASE} bg-gray-50`;
const TD = "border-b border-gray-100 px-3 py-3 text-sm align-top";

//: Separadores de la comparación. La tabla es `border-separate`, así que los
//: bordes van en cada celda (encabezado y filas). Línea marcada al inicio de
//: cada grupo de métricas y suave entre A | B | Cambio. El inicio del primer
//: grupo lo aporta el `border-r` de la columna fija "Meta" (mismo color), así
//: no hay línea doble y el separador sigue a la vista al desplazar.
const INICIO_GRUPO = "border-l border-l-gray-300";
const ENTRE_SUBCOLUMNAS = "border-l border-l-gray-100";
const BORDE_META = "border-r border-r-gray-300";
//: Fondo muy leve de la columna "Cambio". El del encabezado es opaco porque
//: es `sticky`: lo que se desplaza por debajo no debe verse a través.
const FONDO_CAMBIO_CELDA = "bg-gray-50";
const FONDO_CAMBIO_ENCABEZADO = "bg-gray-100";

/**
 * Bordes de una subcolumna (`posicion`: 0 = A, 1 = B, 2 = Cambio) del grupo
 * `grupo` (0 = % Avance físico, 1 = Ejecución, 2 = % Avance financiero).
 */
function bordesSubcolumna(grupo, posicion) {
  if (posicion === 0) return grupo === 0 ? "" : INICIO_GRUPO;
  return ENTRE_SUBCOLUMNAS;
}

/** Bordes y fondo de una celda de fila en esa subcolumna. */
function clasesCelda(grupo, posicion) {
  const fondo = posicion === 2 ? FONDO_CAMBIO_CELDA : "";
  return `${bordesSubcolumna(grupo, posicion)} ${fondo}`;
}

/** "AAAA-MM-DD" → "DD/MM", partiendo el texto (nunca `new Date`). */
function fechaCorta(iso) {
  return fechaCorte(iso)?.slice(0, 5) ?? null;
}

//: Columnas fijas "Código" y "Meta": el `left` de "Meta" es el ancho de
//: "Código"; si uno cambia, cambia el otro.
const ANCHO_CODIGO = "w-[120px] min-w-[120px] max-w-[120px]";
const ANCHO_META = "w-[280px] min-w-[280px] max-w-[280px]";
const LEFT_META = "left-[120px]";

//: Alto de la primera fila del encabezado: la segunda queda fija justo debajo
//: (`top-10`).
const ALTO_FILA_GRUPOS = "h-10";

//: Controles de la pantalla: al menos 40 px, 14 px y foco visible.
const CONTROL =
  "min-h-10 w-full rounded-sm border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-azul focus:outline-none focus-visible:ring-2 focus-visible:ring-azul disabled:cursor-not-allowed disabled:bg-gray-50";
const ETIQUETA = "mb-1.5 block text-sm font-medium text-gray-700";
const BOTON =
  "inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-gray-300 bg-white px-3 text-sm font-medium text-azul hover:bg-secundario focus:outline-none focus-visible:ring-2 focus-visible:ring-azul focus-visible:ring-offset-1";

//: CA06: insignia de una meta que está en un solo corte.
const PRESENCIA = {
  solo_corte_a: "Solo en Corte A",
  solo_corte_b: "Solo en Corte B",
};

const MENSAJE_POCOS_CORTES = "Se necesitan al menos 2 cortes de la vigencia";

/**
 * Mensaje si falla la carga de los cortes de la vigencia. Sesión y permiso
 * usan el mensaje común; lo demás (red, 500) habla de cargar, no de comparar.
 */
function mensajeErrorCortes(error) {
  return error?.estado === 401 || error?.estado === 403
    ? mensajeErrorComparacion(error)
    : "No fue posible cargar los cortes de la vigencia, intente de nuevo.";
}

/** Vigencia de la URL (`?vigencia=2026`), o `null` si falta o no es válida. */
function vigenciaDeLaUrl(parametros) {
  const texto = parametros.get("vigencia") ?? "";
  return /^\d{4}$/.test(texto) ? Number(texto) : null;
}

function Guion({ title }) {
  return (
    <span className="text-gray-500" title={title}>
      —
    </span>
  );
}

/**
 * Celda de la columna "Cambio" (Δ = B − A, CA05). `formato` es `copConSigno`
 * o `ppConSigno`. Sin cambio calculable, "—" con un `title` que explica por
 * qué no es comparable. `className` lleva los bordes y el fondo de la columna.
 */
function CeldaDelta({ valor, formato, sinDato, className = "" }) {
  const sentido = sentidoDelta(valor);
  const clases = `${TD} whitespace-nowrap text-right ${className}`;

  if (sentido === null) {
    return (
      <td className={clases}>
        <Guion title={sinDato} />
      </td>
    );
  }

  if (sentido === "igual") {
    return (
      <td className={clases}>
        <span className="font-mono text-gray-500">{formato(valor)}</span>
        <span className="sr-only">, sin cambio</span>
      </td>
    );
  }

  const sube = sentido === "sube";
  const Flecha = sube ? ArrowUp : ArrowDown;
  return (
    <td className={clases}>
      <span
        className={`inline-flex items-center gap-1 font-mono font-semibold ${
          sube ? "text-green-700" : "text-red-700"
        }`}
      >
        <Flecha size={14} aria-hidden="true" />
        {formato(valor)}
      </span>
      <span className="sr-only">, {sube ? "sube" : "baja"}</span>
    </td>
  );
}

function CeldaValor({ valor, formato, className = "" }) {
  return (
    <td className={`${TD} whitespace-nowrap text-right ${className}`}>
      {valor == null ? (
        <Guion />
      ) : (
        <span className="font-mono">{formato(valor)}</span>
      )}
    </td>
  );
}

function FilaComparacion({ fila }) {
  const enUnSoloCorte = fila.presencia !== "ambos";
  const sinDato = enUnSoloCorte
    ? "No comparable: la meta está en un solo corte"
    : "No comparable: falta el dato en al menos uno de los cortes";

  return (
    <tr>
      <td className={TD}>{fila.sector ?? <Guion />}</td>
      <td
        className={`${TD} sticky left-0 z-10 bg-white font-mono ${ANCHO_CODIGO}`}
      >
        {fila.cod_indicador_producto}
      </td>
      <td
        className={`${TD} sticky z-10 bg-white ${LEFT_META} ${ANCHO_META} ${BORDE_META}`}
      >
        <div className="line-clamp-3" title={fila.nombre_producto ?? ""}>
          {fila.nombre_producto ?? <Guion />}
        </div>
        {enUnSoloCorte && (
          <div className="mt-1.5">
            <StateBadge
              texto={PRESENCIA[fila.presencia] ?? fila.presencia}
              tono="azul"
              tamano="grande"
            />
          </div>
        )}
      </td>
      {/* % Avance físico: siempre sin dato hasta E-03. */}
      {[0, 1, 2].map((posicion) => (
        <td
          key={posicion}
          className={`${TD} text-right ${clasesCelda(0, posicion)}`}
        >
          <Guion />
        </td>
      ))}
      <CeldaValor
        valor={fila.ejecucion_a}
        formato={(v) => cop(Number(v))}
        className={clasesCelda(1, 0)}
      />
      <CeldaValor
        valor={fila.ejecucion_b}
        formato={(v) => cop(Number(v))}
        className={clasesCelda(1, 1)}
      />
      <CeldaDelta
        valor={fila.ejecucion_delta}
        formato={copConSigno}
        sinDato={sinDato}
        className={clasesCelda(1, 2)}
      />
      <CeldaValor
        valor={fila.avance_financiero_pct_a}
        formato={pct}
        className={clasesCelda(2, 0)}
      />
      <CeldaValor
        valor={fila.avance_financiero_pct_b}
        formato={pct}
        className={clasesCelda(2, 1)}
      />
      <CeldaDelta
        valor={fila.avance_financiero_delta}
        formato={ppConSigno}
        sinDato={sinDato}
        className={clasesCelda(2, 2)}
      />
    </tr>
  );
}

/**
 * Subencabezados A | B | Cambio del grupo `grupo`. Bajo A y B se ve la fecha
 * corta del corte (DD/MM); el `title` y el texto para el lector dicen el
 * significado completo.
 */
function SubencabezadosGrupo({ grupo, fechaA, fechaB }) {
  const subcolumnas = [
    {
      texto: "A",
      fecha: fechaCorta(fechaA),
      detalle: `Corte A, ${fechaCorte(fechaA)}`,
    },
    {
      texto: "B",
      fecha: fechaCorta(fechaB),
      detalle: `Corte B, ${fechaCorte(fechaB)}`,
    },
    { texto: "Cambio", fecha: null, detalle: "Cambio: Corte B menos Corte A" },
  ];
  return subcolumnas.map((sub, posicion) => {
    const esCambio = posicion === 2;
    return (
      <th
        key={sub.texto}
        scope="col"
        title={sub.detalle}
        className={`${TH_BASE} sticky top-10 z-10 text-right ${bordesSubcolumna(grupo, posicion)} ${
          esCambio ? `min-w-[72px] ${FONDO_CAMBIO_ENCABEZADO}` : "bg-gray-50"
        }`}
      >
        <span aria-hidden="true" className="block">
          {sub.texto}
        </span>
        {sub.fecha && (
          <span
            aria-hidden="true"
            className="block font-mono font-normal normal-case tracking-normal text-gray-600"
          >
            {sub.fecha}
          </span>
        )}
        <span className="sr-only">{sub.detalle}</span>
      </th>
    );
  });
}

function TablaComparacion({ datos }) {
  const fechaA = fechaCorte(datos.corte_a.fecha_corte);
  const fechaB = fechaCorte(datos.corte_b.fecha_corte);
  const grupos = ["% Avance físico", "Ejecución", "% Avance financiero"];

  return (
    <table className="w-full border-separate border-spacing-0">
      <caption className="sr-only">
        Comparación del Plan de Acción entre el corte del {fechaA} y el del{" "}
        {fechaB}, una fila por meta
      </caption>
      <thead>
        <tr>
          <th
            scope="col"
            rowSpan={2}
            className={`${TH} sticky top-0 z-10 align-bottom`}
          >
            Sector
          </th>
          <th
            scope="col"
            rowSpan={2}
            className={`${TH} sticky left-0 top-0 z-20 align-bottom ${ANCHO_CODIGO}`}
          >
            Código
          </th>
          <th
            scope="col"
            rowSpan={2}
            className={`${TH} sticky top-0 z-20 align-bottom ${LEFT_META} ${ANCHO_META} ${BORDE_META}`}
          >
            Meta
          </th>
          {grupos.map((grupo, indice) => (
            <th
              key={grupo}
              scope="colgroup"
              colSpan={3}
              className={`${TH} sticky top-0 z-10 ${ALTO_FILA_GRUPOS} ${indice === 0 ? "" : INICIO_GRUPO} text-center`}
            >
              {grupo}
            </th>
          ))}
        </tr>
        <tr>
          {grupos.map((grupo, indice) => (
            <Fragment key={grupo}>
              <SubencabezadosGrupo
                grupo={indice}
                fechaA={datos.corte_a.fecha_corte}
                fechaB={datos.corte_b.fecha_corte}
              />
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {datos.filas.map((fila) => (
          <FilaComparacion key={fila.cod_indicador_producto} fila={fila} />
        ))}
      </tbody>
    </table>
  );
}

function Leyenda() {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm text-gray-600">
      <li>Cambio = Corte B − Corte A.</li>
      <li className="flex items-center gap-1.5">
        <ArrowUp size={14} aria-hidden="true" className="text-green-700" />
        <span>sube</span>
        <ArrowDown size={14} aria-hidden="true" className="ml-2 text-red-700" />
        <span>baja; en gris, sin cambio.</span>
      </li>
      <li>«—»: no comparable o sin dato.</li>
      <li>% Avance físico: pendiente de E-03, todavía no hay datos.</li>
    </ul>
  );
}

/** Selector de un corte. `deshabilitado` es el id elegido en el otro. */
function SelectorCorte({
  id,
  etiqueta,
  valor,
  cortes,
  otro,
  onCambiar,
  bloqueado,
}) {
  return (
    <div>
      <label htmlFor={id} className={ETIQUETA}>
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        disabled={bloqueado}
        onChange={(evento) => onCambiar(evento.target.value)}
        className={CONTROL}
      >
        <option value="">Elija un corte</option>
        {cortes.map((corte) => (
          <option key={corte.id} value={corte.id} disabled={corte.id === otro}>
            {fechaCorte(corte.fecha_corte)}
          </option>
        ))}
      </select>
    </div>
  );
}

function EnlaceVolver() {
  return (
    <Link to="/plan-accion" className={BOTON}>
      <ArrowLeft size={16} aria-hidden="true" />
      Volver al Plan de Acción
    </Link>
  );
}

/** Resultado de la comparación: rótulos A/B, controles, tabla y estados. */
function Resultado({
  corte1,
  corte2,
  soloCambios,
  onCambiarSoloCambios,
  bloqueado,
  onExportando,
}) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState({
    clave: null,
    datos: null,
    error: null,
  });
  // Última comparación mostrada, por par de cortes: al alternar "Solo metas
  // con cambios" la tabla sigue a la vista mientras llega la nueva.
  const [visible, setVisible] = useState({ par: null, datos: null });

  const par = `${corte1}:${corte2}`;
  const claveActual = `${par}:${soloCambios}:${intento}`;

  useEffect(() => {
    const clave = `${corte1}:${corte2}:${soloCambios}:${intento}`;
    let vigente = true;

    api
      .compararCortes(consultaComparacion(corte1, corte2, soloCambios))
      .then((datos) => {
        if (!vigente) return;
        setResultado({ clave, datos, error: null });
        setVisible({ par: `${corte1}:${corte2}`, datos });
      })
      .catch((error) => {
        if (vigente) setResultado({ clave, datos: null, error });
      });

    return () => {
      vigente = false;
    };
  }, [corte1, corte2, soloCambios, intento]);

  const cargando = resultado.clave !== claveActual;
  const error = cargando ? null : resultado.error;
  const datos = visible.par === par ? visible.datos : null;
  const actualizando = cargando && datos !== null;

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {/* Solo el mensaje es la alerta: el botón queda fuera para que el
            lector no lo anuncie como parte del error. */}
        <p role="alert">{mensajeErrorComparacion(error)}</p>
        <button
          type="button"
          onClick={() => setIntento((n) => n + 1)}
          className={BOTON}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (datos === null) {
    return <Cargando mensaje="Comparando los cortes…" />;
  }

  const total = datos.filas.length;
  const textoConteo = soloCambios
    ? `${total} ${total === 1 ? "meta con cambios" : "metas con cambios"}`
    : `Mostrando ${total} ${total === 1 ? "meta" : "metas"}`;

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <dl className="grid gap-1 text-sm text-gray-700">
            <div className="flex gap-1.5">
              <dt className="font-semibold">Corte A (más antiguo):</dt>
              <dd className="font-mono">
                {fechaCorte(datos.corte_a.fecha_corte)}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold">Corte B (más reciente):</dt>
              <dd className="font-mono">
                {fechaCorte(datos.corte_b.fecha_corte)}
              </dd>
            </div>
          </dl>

          {/* La `key` vuelve a montar el botón al cambiar de cortes o de
              filtro: el mensaje de la exportación anterior ya no corresponde
              a lo que se ve. */}
          <BotonExportarExcel
            key={`${par}:${soloCambios}`}
            descargar={() =>
              api.exportarComparacion(
                consultaComparacion(corte1, corte2, soloCambios),
              )
            }
            nombreRespaldo={nombreArchivoComparacion(
              datos.corte_a.vigencia,
              datos.corte_a.fecha_corte,
              datos.corte_b.fecha_corte,
            )}
            mensajeDeError={mensajeErrorExportarComparacion}
            deshabilitado={total === 0 || actualizando}
            tituloDeshabilitado="No hay metas para exportar"
            alCambiarExportando={onExportando}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={soloCambios}
              disabled={bloqueado}
              onChange={(evento) => onCambiarSoloCambios(evento.target.checked)}
              className="h-5 w-5 accent-azul focus:outline-none focus-visible:ring-2 focus-visible:ring-azul focus-visible:ring-offset-1"
            />
            Solo metas con cambios
          </label>
          {actualizando && (
            <span className="text-sm text-gray-600">Actualizando…</span>
          )}
          {/* Región live siempre montada mientras hay resultado. */}
          <p
            aria-live="polite"
            aria-atomic="true"
            className="ml-auto text-sm font-medium text-gray-700"
          >
            {textoConteo}
          </p>
        </div>
      </Card>

      {total === 0 ? (
        <Vacio
          titulo={
            soloCambios
              ? "No hay metas con cambios entre estos dos cortes"
              : "Los cortes no tienen metas para comparar"
          }
        />
      ) : (
        <>
          <Leyenda />
          <Card padding="p-0" className="overflow-hidden">
            {/* `relative` es imprescindible: los textos `sr-only` de las
                celdas son `position: absolute`. Sin un ancestro posicionado
                su bloque contenedor era el documento, escapaban del scroll de
                la tabla y estiraban la página miles de píxeles por debajo de
                la tabla (medido: 7 719 px de alto frente a 902 px). */}
            <div
              aria-busy={actualizando}
              className="relative max-h-[70vh] overflow-auto"
            >
              <TablaComparacion datos={datos} />
            </div>
          </Card>
        </>
      )}
    </>
  );
}

/** Selectores y resultado, una vez cargados los cortes de la vigencia. */
function ContenidoComparacion({ cortes }) {
  const [corte1, setCorte1] = useState("");
  const [corte2, setCorte2] = useState("");
  const [soloCambios, setSoloCambios] = useState(false);
  const [exportando, setExportando] = useState(false);

  const listos = corte1 !== "" && corte2 !== "" && corte1 !== corte2;

  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectorCorte
            id="corte-1"
            etiqueta="Primer corte"
            valor={corte1}
            cortes={cortes}
            otro={corte2}
            onCambiar={setCorte1}
            bloqueado={exportando}
          />
          <SelectorCorte
            id="corte-2"
            etiqueta="Segundo corte"
            valor={corte2}
            cortes={cortes}
            otro={corte1}
            onCambiar={setCorte2}
            bloqueado={exportando}
          />
        </div>
        {!listos && (
          <p className="mt-3 text-sm text-gray-600">
            Elija dos cortes para comparar
          </p>
        )}
      </Card>

      {listos && (
        <Resultado
          corte1={corte1}
          corte2={corte2}
          soloCambios={soloCambios}
          onCambiarSoloCambios={setSoloCambios}
          bloqueado={exportando}
          onExportando={setExportando}
        />
      )}
    </>
  );
}

export default function CompararCortes() {
  const [parametros] = useSearchParams();
  const vigencia = vigenciaDeLaUrl(parametros);

  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState({
    clave: null,
    datos: null,
    error: null,
  });

  const claveActual = vigencia === null ? null : `${vigencia}:${intento}`;

  useEffect(() => {
    if (vigencia === null) return;
    const clave = `${vigencia}:${intento}`;
    let vigente = true;

    api
      .cortesDisponibles(vigencia)
      .then((datos) => {
        if (vigente) setResultado({ clave, datos, error: null });
      })
      .catch((error) => {
        if (vigente) setResultado({ clave, datos: null, error });
      });

    return () => {
      vigente = false;
    };
  }, [vigencia, intento]);

  const encabezado = (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-800">Comparar cortes</h1>
        {vigencia !== null && (
          <p className="mt-0.5 text-sm text-gray-600">Vigencia {vigencia}</p>
        )}
      </div>
      <EnlaceVolver />
    </header>
  );

  if (vigencia === null) {
    return (
      <section className="mx-auto max-w-4xl">
        {encabezado}
        <Vacio
          titulo="No se indicó la vigencia a comparar"
          descripcion="Abra la comparación desde el botón «Comparar cortes» del Plan de Acción."
        />
      </section>
    );
  }

  const cargando = resultado.clave !== claveActual;

  let contenido;
  if (cargando) {
    contenido = <Cargando mensaje="Cargando los cortes de la vigencia…" />;
  } else if (resultado.error) {
    contenido = (
      <EstadoError
        error={{
          ...resultado.error,
          message: mensajeErrorCortes(resultado.error),
        }}
        onReintentar={() => setIntento((n) => n + 1)}
      />
    );
  } else if (resultado.datos.length < 2) {
    contenido = (
      <Vacio
        titulo={MENSAJE_POCOS_CORTES}
        descripcion={`La vigencia ${vigencia} tiene ${resultado.datos.length} ${
          resultado.datos.length === 1
            ? "corte finalizado"
            : "cortes finalizados"
        }.`}
      />
    );
  } else {
    contenido = <ContenidoComparacion cortes={resultado.datos} />;
  }

  return (
    <section className="mx-auto max-w-[1400px]">
      {encabezado}
      {contenido}
    </section>
  );
}
