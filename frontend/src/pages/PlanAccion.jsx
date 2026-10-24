/**
 * Plan de Acción consolidado del corte actual.
 *
 * TARJETA: [E04-HU01] Consultar Plan de Acción Consolidado
 * ESPECIFICACIÓN: docs/specs/E04-HU01-plan-accion-consolidado.md
 * CONTRATO: `api.planAccionActual` (api/cliente.js) — una fila por meta del
 * corte REGISTRADO más reciente, con su resumen. Solo lectura (CA04): esta
 * pantalla no tiene ningún control de edición.
 *
 * COLUMNAS (CA02): salen las 12 que el backend entrega. El CA02 pide 14, pero
 * "Meta", "Indicador" y "Producto" son hoy solo dos campos reales
 * (`cod_indicador_producto` → "Código meta", `nombre_producto` → "Meta"), y
 * D26 punto 5 deja pendiente del PO qué son los otros dos: no se muestran
 * columnas inventadas.
 *
 * RUBRO Y CONTRATO(S) se apartan del CA02 literal: en vez de la lista, se
 * muestra el conteo ("24 rubros"). Los datos reales traen códigos de rubro de
 * ~70 caracteres y metas con decenas de rubros o contratos; en una celda
 * serían ilegibles. Con un solo valor se muestra el valor (recortado). La
 * lista completa está en el detalle de la meta; el `title` de la celda queda
 * como apoyo.
 *
 * CA06: la celda sin dato (`null` o lista vacía) se resalta SOLO ella, con un
 * fondo ámbar tenue, y la leyenda lo explica. "% Avance físico" no se resalta
 * (el backend lo manda siempre `null` hasta que exista E-03): muestra "—" en
 * gris y la leyenda lo aclara. Un "0.00" es un dato ($ 0), no un vacío.
 *
 * CA03 (versión plana): cada fila tiene un botón "Ver detalle" en la celda de
 * "Código meta" que abre una subfila con la meta, su estado y su BPIN, las
 * tres cifras de la meta y las listas de rubros y contratos. Solo muestra lo
 * que la respuesta ya trae: las listas completas y UN BPIN. No puede mostrar
 * el monto de cada rubro ni el objeto, valor o estado de cada contrato (eso
 * requiere ampliar el backend, y la pantalla lo avisa en lenguaje llano).
 * Varias filas pueden estar abiertas a la vez.
 *
 * LEGIBILIDAD: esta pantalla se aparta a propósito de la escala compacta de
 * docs/DESIGN_SPEC.md §3 (encabezados de 10px en `gray-400`, celdas de 12px).
 * La usuaria final necesita leer cómodamente, y `gray-400` sobre `gray-50` no
 * alcanza el contraste AA (4,5:1). Aquí el cuerpo va a 14px, los encabezados a
 * 12px en `gray-600`, con más espacio entre filas y botones de al menos 32px.
 * La escala del resto de pantallas no cambia.
 *
 * CA07: el scroll horizontal es SOLO el del contenedor de la tabla (único
 * `overflow-auto`, en x e y); la página no se ensancha gracias al `min-w-0`
 * del panel de `Disposicion.jsx`. Montos, porcentajes y meta programada
 * llevan `whitespace-nowrap`: sin él, al angostarse la tabla (p. ej. con
 * zoom) "$ 3.868.543.056" se partía en "$" y la cifra. El encabezado queda
 * fijo arriba y "Código meta" y "Meta" fijos a la izquierda con
 * `position: sticky`: por eso la tabla usa `border-separate`
 * (con `border-collapse` los bordes de las celdas fijas se pierden al
 * desplazar), las dos columnas fijas tienen ancho fijo (el `left` de "Meta" es
 * el ancho de "Código meta") y sus celdas llevan fondo opaco. "Código meta"
 * mide 150 px porque aloja, debajo del código, el botón "Ver detalle" a 14px;
 * "Meta" mide 280 px para que los nombres se lean en hasta tres líneas. Si
 * cambia el ancho de "Código meta", cambia también `LEFT_META`.
 *
 * TARJETA: [E04-HU02] Filtrar el Plan de Acción
 * ESPECIFICACIÓN: docs/specs/E04-HU02-filtrar-plan-accion.md
 * FILTROS (CA01 a CA09): el panel está cerrado al entrar; el botón "Filtros
 * (n)" lo abre y las etiquetas activas se ven siempre (ver
 * `components/FiltrosPlanAccion.jsx`). Se filtra EN MEMORIA sobre las filas que
 * ya trajo `GET /plan-accion/actual`, con `lib/filtrosPlanAccion.js`, que
 * replica la regla del backend; el resumen del pie (CA06) se recalcula sobre
 * lo filtrado. El estado de filtros es UN objeto con los nombres de los
 * query params del backend, para que [E04-HU03] lo mande tal cual al exportar.
 * Sin resultados (CA07) se muestra el aviso con "Limpiar filtros".
 *
 * La tabla (`TablaPlan`) sigue montada aunque no haya resultados (solo se
 * oculta): así conserva su conjunto de filas abiertas y una fila abierta que
 * sale del filtro y vuelve sigue abierta. Al cambiar un filtro, el scroll de
 * la tabla vuelve arriba.
 *
 * TARJETA: [E04-HU03] Exportar el Plan de Acción a Excel
 * ESPECIFICACIÓN: docs/specs/E04-HU03-exportar-plan-accion-excel.md
 * EXPORTAR (CA01, CA02, CA05, CA07, CA08): el botón "Exportar a Excel" baja lo
 * que se ve con los filtros activos (o todo, sin filtros) de `GET
 * /plan-accion/exportar`, que acepta los mismos query params que `/actual`.
 * La consulta se arma al hacer clic con `consultaDeFiltros(filtros)`. Sin
 * filas visibles el botón está deshabilitado (CA07). Mientras exporta NO se
 * usa `disabled` (algunos navegadores sacan el foco del botón): se usa
 * `aria-disabled`, `aria-busy`, el texto "Generando archivo…" y un ref que
 * ignora un segundo clic. El nombre del archivo es el del servidor; si el
 * navegador no deja leerlo, el de D28 (ver `lib/descarga.js`). Cualquier
 * fallo, incluso al guardar, cae en el mensaje de error (CA08), y un mismo
 * intento publica un solo mensaje: el éxito por una región `aria-live` y el
 * error solo con `role="alert"`.
 *
 * TARJETA: [E04-HU04] Comparar dos cortes de una misma vigencia
 * COMPARAR (CA01, CA02): la barra pide los cortes REGISTRADO de la vigencia
 * (`api.cortesDisponibles`). Con 2 o más, "Comparar cortes" lleva a
 * `/plan-accion/comparar?vigencia=N` (`CompararCortes.jsx`); con menos, el
 * botón está deshabilitado con el aviso "Se necesitan al menos 2 cortes de la
 * vigencia" visible a su lado. Si esa consulta falla, el botón queda
 * deshabilitado con su propio aviso y el resto de la pantalla sigue igual.
 */
import {
  ArrowLeftRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Download,
  Info,
  LoaderCircle,
} from "lucide-react";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/cliente.js";
import { Cargando, EstadoError, Vacio } from "../components/Estados.jsx";
import FiltrosPlanAccion from "../components/FiltrosPlanAccion.jsx";
import Card from "../components/shared/Card.jsx";
import StateBadge from "../components/shared/StateBadge.jsx";
import {
  guardarArchivo,
  mensajeErrorExportacion,
  nombreArchivoPlanAccion,
} from "../lib/descarga.js";
import { agregarValor, quitarValor } from "../lib/filtros.js";
import {
  busquedaAplicable,
  calcularResumen,
  consultaDeFiltros,
  contarActivosPlan,
  FILTROS_PLAN_VACIOS,
  filtrarPlanAccion,
  opcionesIndicador,
  opcionesSector,
} from "../lib/filtrosPlanAccion.js";
import { cop, numero, pct } from "../lib/formato.js";

//: Estado de cruce por meta (D26 punto 3) → texto y tono del `StateBadge`.
const ESTADOS_CRUCE = {
  completo: { texto: "Completo", tono: "verde" },
  parcial: { texto: "Parcial", tono: "ambar" },
  sin_informacion: { texto: "Sin información", tono: "gris" },
};

//: Las casillas de "Estado de cruce" del panel: `valor` es el que entiende
//: el backend (`estado_cruce`).
const ESTADOS_PARA_FILTRO = Object.entries(ESTADOS_CRUCE).map(
  ([valor, { texto }]) => ({ valor, texto }),
);

//: Clases comunes de encabezado y celda. Los bordes van en cada celda (no en
//: la fila) porque la tabla es `border-separate`.
const TH =
  "whitespace-nowrap border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600";
const TD = "border-b border-gray-100 px-4 py-3 text-sm align-top";

//: Botón secundario de la pantalla ("Ver detalle", "Ver los N rubros"):
//: al menos 32px de alto y foco visible.
const BOTON =
  "inline-flex min-h-8 items-center rounded-sm border border-gray-300 bg-white px-2.5 text-sm font-medium text-azul hover:bg-secundario focus:outline-none focus-visible:ring-2 focus-visible:ring-azul focus-visible:ring-offset-1";

//: Botón de la barra de filtros ("Filtros", "Limpiar filtros"): al menos 40px
//: de alto, 14px y foco visible. Aparte de `BOTON` porque dos `min-h-*` en la
//: misma clase no se pueden pisar entre sí.
const BOTON_FILTROS =
  "inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-gray-300 bg-white px-3 text-sm font-medium text-azul hover:bg-secundario focus:outline-none focus-visible:ring-2 focus-visible:ring-azul focus-visible:ring-offset-1";

//: Anchos de las dos columnas fijas (CA07). El `left` de la segunda es el
//: ancho de la primera; si uno cambia, cambia el otro.
const ANCHO_CODIGO = "w-[150px] min-w-[150px] max-w-[150px]";
const ANCHO_META = "w-[280px] min-w-[280px] max-w-[280px]";
const LEFT_META = "left-[150px]";

//: Cantidad de columnas de la tabla: debe coincidir con los `<th>` de
//: `TablaPlan` (es el `colSpan` de la subfila de detalle).
const NUM_COLUMNAS = 12;

//: Ancho del panel de detalle. Va en un contenedor `sticky left-0` para que
//: no se desplace con el scroll horizontal; se limita al ancho visible
//: (viewport menos barra lateral y márgenes) para que no quede cortado.
const ANCHO_DETALLE = "w-[min(960px,calc(100vw_-_320px))]";

//: Rubros y contratos que el detalle muestra antes de "Ver los N …".
const VISIBLES = 5;

function fechaCorte(iso) {
  // "YYYY-MM-DD" → "DD/MM/AAAA" partiendo el texto: pasar por `new Date()`
  // lo interpreta como UTC y puede mostrar el día anterior.
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Solo se usa con 2 o más valores (con 1 se muestra el valor), así que el
// plural es el único caso.
function etiquetaConteo(cantidad, singular) {
  return `${cantidad} ${singular}s`;
}

/**
 * Celda (`td`) con el resaltado tenue de CA06 cuando `vacia`. `fija` es para
 * las columnas con `sticky` (CA07): necesitan un fondo opaco, o el contenido
 * que se desplaza se vería por debajo; el resaltado de celda vacía también es
 * opaco, así que lo reemplaza.
 */
function Celda({ vacia, fija = false, className = "", children, ...resto }) {
  let fondo = "";
  if (vacia) fondo = "bg-amber-50";
  else if (fija) fondo = "bg-white";

  return (
    <td className={`${TD} ${fondo} ${className}`} {...resto}>
      {vacia ? <span className="text-gray-500">—</span> : children}
    </td>
  );
}

/** Rubro / Contrato(s): ver el comentario del módulo. */
function CeldaLista({ valores, singular }) {
  if (valores.length === 0) return <Celda vacia />;

  const completa = valores.join("\n");
  return (
    <Celda title={completa}>
      {valores.length === 1 ? (
        <span className="block max-w-[200px] truncate font-mono">
          {valores[0]}
        </span>
      ) : (
        etiquetaConteo(valores.length, singular)
      )}
    </Celda>
  );
}

function estadoDeCruce(fila) {
  // Respaldo por si el backend manda un estado que esta pantalla no conoce.
  return (
    ESTADOS_CRUCE[fila.estado_cruce] ?? {
      texto: fila.estado_cruce,
      tono: "gris",
    }
  );
}

function FilaPlan({ fila, abierta, onAlternar }) {
  const estado = estadoDeCruce(fila);
  const codigo = fila.cod_indicador_producto;
  const idDetalle = `detalle-${codigo}`;

  return (
    <Fragment>
      <tr>
        <Celda vacia={fila.sector == null}>{fila.sector}</Celda>
        <Celda fija className={`sticky left-0 z-10 ${ANCHO_CODIGO}`}>
          <div className="flex flex-col items-start gap-1.5">
            <span className="font-mono">{codigo}</span>
            {/* El `aria-label` contiene el texto visible (WCAG 2.5.3) y el
                código, para distinguir las filas en un lector de pantalla. */}
            <button
              type="button"
              onClick={() => onAlternar(codigo)}
              aria-expanded={abierta}
              aria-controls={idDetalle}
              aria-label={`${abierta ? "Ocultar" : "Ver"} detalle de la meta ${codigo}`}
              className={BOTON}
            >
              {abierta ? "Ocultar" : "Ver detalle"}
            </button>
          </div>
        </Celda>
        <Celda
          fija
          vacia={fila.nombre_producto == null}
          className={`sticky z-10 ${LEFT_META} ${ANCHO_META} border-r border-r-gray-200`}
        >
          <div className="line-clamp-3" title={fila.nombre_producto}>
            {fila.nombre_producto}
          </div>
        </Celda>
        <Celda
          vacia={fila.meta_programada == null}
          className="whitespace-nowrap text-right"
        >
          <span className="font-mono">{numero(fila.meta_programada)}</span>
        </Celda>
        <Celda vacia={fila.cod_bpin == null}>
          <span className="font-mono">{fila.cod_bpin}</span>
        </Celda>
        <CeldaLista valores={fila.rubros} singular="rubro" />
        <Celda
          vacia={fila.presupuesto_definitivo == null}
          className="whitespace-nowrap text-right"
        >
          <span className="font-mono">
            {cop(Number(fila.presupuesto_definitivo))}
          </span>
        </Celda>
        <Celda
          vacia={fila.ejecucion == null}
          className="whitespace-nowrap text-right"
        >
          <span className="font-mono">{cop(Number(fila.ejecucion))}</span>
        </Celda>
        <CeldaLista valores={fila.contratos} singular="contrato" />
        <td className={`${TD} whitespace-nowrap text-right`}>
          <span className="font-mono text-gray-500">
            {fila.avance_fisico_pct == null ? "—" : pct(fila.avance_fisico_pct)}
          </span>
        </td>
        <Celda
          vacia={fila.avance_financiero_pct == null}
          className="whitespace-nowrap text-right"
        >
          <span className="font-mono">{pct(fila.avance_financiero_pct)}</span>
        </Celda>
        <td className={TD}>
          <StateBadge texto={estado.texto} tono={estado.tono} tamano="grande" />
        </td>
      </tr>
      {abierta && <DetalleMeta fila={fila} id={idDetalle} />}
    </Fragment>
  );
}

/**
 * Lista de rubros o contratos del detalle: una por línea, completa. Muestra
 * los primeros `VISIBLES` y un botón "Ver los N …" que despliega el resto en
 * la misma página, sin caja con scroll interno.
 */
function ListaDetalle({ id, valores, plural, vacio }) {
  const [todos, setTodos] = useState(false);

  if (valores.length === 0) {
    return <p className="text-sm text-gray-500">{vacio}</p>;
  }

  const mostrados = todos ? valores : valores.slice(0, VISIBLES);

  return (
    <>
      <ul id={id} className="divide-y divide-gray-100 font-mono text-sm">
        {mostrados.map((valor) => (
          <li key={valor} className="break-all py-1.5">
            {valor}
          </li>
        ))}
      </ul>
      {valores.length > VISIBLES && (
        <button
          type="button"
          onClick={() => setTodos((actual) => !actual)}
          aria-expanded={todos}
          aria-controls={id}
          className={`${BOTON} mt-2`}
        >
          {todos ? "Ver menos" : `Ver los ${valores.length} ${plural}`}
        </button>
      )}
    </>
  );
}

/**
 * Cifra grande del detalle. `null` es "—" (sin dato); un "0.00" es un dato.
 * `barra` dibuja el % como barra de un solo color, sin umbrales (los define
 * el PO); es decorativa porque la cifra ya está en texto.
 */
function Cifra({ etiqueta, valor, formato, barra = false }) {
  const ancho = Math.min(100, Math.max(0, Number(valor)));

  return (
    <Card padding="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
        {etiqueta}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold text-navy">
        {valor == null ? "—" : formato(valor)}
      </p>
      {barra && valor != null && (
        <div
          aria-hidden="true"
          className="mt-3 h-2 w-full rounded-sm bg-gray-200"
        >
          <div
            className="h-full rounded-sm bg-azul"
            style={{ width: `${ancho}%` }}
          />
        </div>
      )}
    </Card>
  );
}

/**
 * Subfila de detalle (CA03, versión plana). El contenido va en un contenedor
 * `sticky left-0` de ancho acotado: la subfila ocupa todo el ancho de la
 * tabla, y sin eso el panel se iría con el scroll horizontal. El orden visual
 * (meta y BPIN, luego rubros y contratos) sigue la cadena de CA03.
 */
function DetalleMeta({ fila, id }) {
  const estado = estadoDeCruce(fila);
  const codigo = fila.cod_indicador_producto;

  return (
    <tr id={id}>
      <td
        colSpan={NUM_COLUMNAS}
        className="border-b border-gray-200 bg-fondo-pagina p-0"
      >
        <div className={`sticky left-0 ${ANCHO_DETALLE} px-4 py-4`}>
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Meta <span className="font-mono">{codigo}</span>
            </p>
            <p className="mt-0.5 text-base font-semibold text-gray-800">
              {fila.nombre_producto ?? "—"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <StateBadge
                texto={estado.texto}
                tono={estado.tono}
                tamano="grande"
              />
              {fila.cod_bpin == null ? (
                <span className="text-gray-500">Sin BPIN</span>
              ) : (
                <span className="text-gray-700">
                  BPIN <span className="font-mono">{fila.cod_bpin}</span>
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Cifra
              etiqueta="Presupuesto definitivo"
              valor={fila.presupuesto_definitivo}
              formato={(v) => cop(Number(v))}
            />
            <Cifra
              etiqueta="Ejecución"
              valor={fila.ejecucion}
              formato={(v) => cop(Number(v))}
            />
            <Cifra
              etiqueta="% Avance financiero"
              valor={fila.avance_financiero_pct}
              formato={pct}
              barra
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Card padding="p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">
                Rubros ({fila.rubros.length})
              </h3>
              <ListaDetalle
                id={`rubros-${codigo}`}
                valores={fila.rubros}
                plural="rubros"
                vacio="Sin rubros"
              />
            </Card>
            <Card padding="p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">
                Contratos ({fila.contratos.length})
              </h3>
              <ListaDetalle
                id={`contratos-${codigo}`}
                valores={fila.contratos}
                plural="contratos"
                vacio="Sin contratos"
              />
            </Card>
          </div>

          <p className="mt-4 flex items-start gap-2 text-sm text-gray-600">
            <Info
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-azul"
            />
            <span>
              Por ahora se muestran los números de contrato y los códigos de
              rubro. El detalle de cada contrato (objeto, valor y estado) se
              agregará más adelante.
            </span>
          </p>
        </div>
      </td>
    </tr>
  );
}

function Leyenda() {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm text-gray-600">
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-6 rounded-sm border border-amber-200 bg-amber-50"
        />
        <span>
          Celda resaltada: dato sin información en las fuentes del corte.
        </span>
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="font-mono text-gray-500">
          —
        </span>
        <span>% Avance físico: pendiente de E-03, todavía no hay datos.</span>
      </li>
      <li>
        Pulse «Ver detalle» para ver la lista completa de rubros y contratos.
      </li>
    </ul>
  );
}

function TablaPlan({ filas }) {
  // Filas abiertas, por código de meta: pueden estar abiertas varias a la vez.
  const [abiertas, setAbiertas] = useState(() => new Set());

  function alternar(codigo) {
    setAbiertas((anteriores) => {
      const siguientes = new Set(anteriores);
      if (siguientes.has(codigo)) siguientes.delete(codigo);
      else siguientes.add(codigo);
      return siguientes;
    });
  }

  return (
    <table className="w-full border-separate border-spacing-0">
      <caption className="sr-only">
        Plan de Acción consolidado, una fila por meta
      </caption>
      <thead>
        <tr>
          <th scope="col" className={`${TH} sticky top-0 z-10`}>
            Sector
          </th>
          <th
            scope="col"
            className={`${TH} sticky left-0 top-0 z-20 ${ANCHO_CODIGO}`}
          >
            Código meta
          </th>
          <th
            scope="col"
            className={`${TH} sticky top-0 z-20 ${LEFT_META} ${ANCHO_META} border-r border-r-gray-200`}
          >
            Meta
          </th>
          <th
            scope="col"
            title="Meta programada para la vigencia"
            className={`${TH} sticky top-0 z-10 text-right`}
          >
            Meta programada
          </th>
          <th scope="col" className={`${TH} sticky top-0 z-10`}>
            BPIN
          </th>
          <th scope="col" className={`${TH} sticky top-0 z-10`}>
            Rubro
          </th>
          <th scope="col" className={`${TH} sticky top-0 z-10 text-right`}>
            Presupuesto definitivo
          </th>
          <th scope="col" className={`${TH} sticky top-0 z-10 text-right`}>
            Ejecución
          </th>
          <th scope="col" className={`${TH} sticky top-0 z-10`}>
            Contrato(s)
          </th>
          <th
            scope="col"
            title="Pendiente de E-03"
            className={`${TH} sticky top-0 z-10 text-right`}
          >
            % Avance físico
          </th>
          <th scope="col" className={`${TH} sticky top-0 z-10 text-right`}>
            % Avance financiero
          </th>
          <th scope="col" className={`${TH} sticky top-0 z-10`}>
            Estado de cruce
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <FilaPlan
            key={fila.cod_indicador_producto}
            fila={fila}
            abierta={abiertas.has(fila.cod_indicador_producto)}
            onAlternar={alternar}
          />
        ))}
      </tbody>
    </table>
  );
}

/** Qué mostrar según el error del backend (CA09 y CA10). */
function ErrorPlan({ error, onReintentar }) {
  if (error.estado === 404) {
    return (
      <Vacio
        titulo="Aún no hay cortes finalizados para consultar"
        descripcion="El Plan de Acción se arma con el corte registrado más reciente."
      />
    );
  }
  if (error.estado === 403) {
    return (
      <Vacio
        titulo="No tiene permiso para ver el Plan de Acción"
        descripcion="Su rol no tiene acceso a este módulo."
      />
    );
  }
  // 409 (al corte actual le falta una fuente) y cualquier otro error:
  // `EstadoError` ya lista `detalles.archivos_faltantes`.
  return <EstadoError error={error} onReintentar={onReintentar} />;
}

/**
 * Barra y panel de filtros, leyenda, tabla y pie (E04-HU02). Es un componente
 * aparte para que sus hooks queden antes de cualquier `return` temprano de
 * `PlanAccion` (carga y error) y para que los filtros se reinicien al
 * recargar el plan (se desmonta mientras carga).
 */
/**
 * [E04-HU04/CA01-CA02] "Comparar cortes". `cortes` es la respuesta de
 * `cortesDisponibles` (o `null` mientras carga) y `error` el de esa consulta.
 * Con 2 o más cortes es un enlace; si no, un botón deshabilitado con el motivo
 * visible a su lado (asociado con `aria-describedby`). El aspecto
 * deshabilitado no depende solo del color: borde discontinuo y cursor de "no
 * permitido".
 */
function BotonCompararCortes({ vigencia, cortes, error }) {
  const idAviso = useId();

  if (!error && cortes !== null && cortes.length >= 2) {
    return (
      <Link
        to={`/plan-accion/comparar?vigencia=${vigencia}`}
        className={BOTON_FILTROS}
      >
        <ArrowLeftRight size={16} aria-hidden="true" />
        Comparar cortes
      </Link>
    );
  }

  let aviso = null;
  if (error) aviso = "No se pudo comprobar los cortes disponibles";
  else if (cortes !== null) {
    aviso = "Se necesitan al menos 2 cortes de la vigencia";
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled
        aria-describedby={aviso ? idAviso : undefined}
        aria-busy={cortes === null && !error}
        className={`${BOTON_FILTROS} disabled:cursor-not-allowed disabled:border-dashed disabled:bg-gray-50 disabled:text-gray-500`}
      >
        <ArrowLeftRight size={16} aria-hidden="true" />
        Comparar cortes
      </button>
      {aviso && (
        <span id={idAviso} className="text-sm text-gray-600">
          {aviso}
        </span>
      )}
    </span>
  );
}

function ContenidoPlan({ datos }) {
  const [filtros, setFiltros] = useState(FILTROS_PLAN_VACIOS);
  // Lo que la persona escribe en "Meta". `filtros.busqueda` guarda solo el
  // texto ya aplicable (3 o más caracteres, recortado).
  const [textoMeta, setTextoMeta] = useState("");
  const [panelAbierto, setPanelAbierto] = useState(false);
  const idPanel = useId();
  // Botón "Filtros": destino del foco cuando desaparece el control pulsado
  // (quitar la última etiqueta o "Limpiar filtros").
  const refBotonFiltros = useRef(null);
  // Contenedor con scroll de la tabla: vuelve arriba al cambiar un filtro.
  const refScroll = useRef(null);
  // Exportación a Excel. `exportando` pinta el botón; `refExportando` es el
  // cerrojo contra un segundo clic (el estado se actualiza después del render,
  // el ref al instante). `mensajeExito` y `mensajeError` nunca están los dos.
  const [exportando, setExportando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [mensajeError, setMensajeError] = useState("");
  const refExportando = useRef(false);
  // [E04-HU04] Cortes REGISTRADO de la vigencia, para "Comparar cortes".
  // `clave` es la vigencia de lo guardado: mientras no coincida, carga. El
  // único setState del efecto ocurre en los callbacks de la promesa.
  const [cortes, setCortes] = useState({
    clave: null,
    datos: null,
    error: null,
  });

  useEffect(() => {
    const clave = datos.vigencia;
    let vigente = true;

    api
      .cortesDisponibles(clave)
      .then((lista) => {
        if (vigente) setCortes({ clave, datos: lista, error: null });
      })
      .catch((error) => {
        if (vigente) setCortes({ clave, datos: null, error });
      });

    return () => {
      vigente = false;
    };
  }, [datos.vigencia]);

  const cortesListos = cortes.clave === datos.vigencia;

  // Las opciones salen de TODAS las filas, no de las filtradas: no se
  // reducen al filtrar.
  const sectores = useMemo(() => opcionesSector(datos.filas), [datos.filas]);
  const indicadores = useMemo(
    () => opcionesIndicador(datos.filas),
    [datos.filas],
  );

  const filasVisibles = filtrarPlanAccion(datos.filas, filtros);
  // CA06: el resumen se calcula DESPUÉS de filtrar.
  const resumen = calcularResumen(filasVisibles);
  const activos = contarActivosPlan(filtros);
  const sinResultados = filasVisibles.length === 0;

  function volverArriba() {
    if (refScroll.current) refScroll.current.scrollTop = 0;
  }

  // [E04-HU03] Un cambio de filtro deja obsoleto el último "Descarga lista" o
  // aviso de error: ya no corresponde a lo que se ve. Se borra aquí, en los
  // manejadores, no en un efecto (regla set-state-in-effect), y nunca por
  // tiempo: un mensaje no desaparece solo.
  function borrarMensajesExportacion() {
    setMensajeExito("");
    setMensajeError("");
  }

  // Funcional (`anteriores`) para no leer un `filtros` viejo si llegan dos
  // cambios seguidos.
  function agregarFiltro(clave, valor) {
    setFiltros((anteriores) => agregarValor(anteriores, clave, valor));
    borrarMensajesExportacion();
    volverArriba();
  }

  function quitarFiltro(clave, valor) {
    if (clave === "busqueda") {
      setTextoMeta("");
      setFiltros((anteriores) => ({ ...anteriores, busqueda: "" }));
    } else {
      setFiltros((anteriores) => quitarValor(anteriores, clave, valor));
    }
    borrarMensajesExportacion();
    volverArriba();
  }

  function alternarEstado(valor) {
    setFiltros((anteriores) =>
      anteriores.estado_cruce.includes(valor)
        ? quitarValor(anteriores, "estado_cruce", valor)
        : agregarValor(anteriores, "estado_cruce", valor),
    );
    borrarMensajesExportacion();
    volverArriba();
  }

  function cambiarTextoMeta(texto) {
    setTextoMeta(texto);
    setFiltros((anteriores) => ({
      ...anteriores,
      busqueda: busquedaAplicable(texto),
    }));
    borrarMensajesExportacion();
    volverArriba();
  }

  // CA08: vuelve a mostrar todas las metas. El foco pasa a "Filtros" porque
  // el botón pulsado desaparece; se hace aquí, en el manejador, no en un
  // efecto.
  function limpiarFiltros() {
    setFiltros(FILTROS_PLAN_VACIOS);
    setTextoMeta("");
    borrarMensajesExportacion();
    volverArriba();
    refBotonFiltros.current?.focus();
  }

  // [E04-HU03] Descarga lo que se ve. La consulta se calcula AQUÍ, al hacer
  // clic, con los `filtros` de ese instante. `guardarArchivo` va dentro del
  // `try` para que un fallo al guardar también caiga en el mensaje de error
  // (CA08); el `finally` baja el cerrojo y `exportando` pase lo que pase.
  async function exportar() {
    if (sinResultados || refExportando.current) return;
    refExportando.current = true;
    setExportando(true);
    // Un intento nuevo borra el mensaje anterior: nunca quedan juntos un
    // "Descarga lista" viejo y un error.
    setMensajeExito("");
    setMensajeError("");

    try {
      const consulta = consultaDeFiltros(filtros);
      const { blob, nombre } = await api.exportarPlanAccion(consulta);
      const nombreArchivo =
        nombre ?? nombreArchivoPlanAccion(datos.vigencia, datos.fecha_corte);
      guardarArchivo(blob, nombreArchivo);
      setMensajeExito(`Descarga lista: ${nombreArchivo}`);
    } catch (error) {
      setMensajeError(mensajeErrorExportacion(error));
    } finally {
      refExportando.current = false;
      setExportando(false);
    }
  }

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={refBotonFiltros}
            type="button"
            aria-expanded={panelAbierto}
            aria-controls={idPanel}
            onClick={() => setPanelAbierto((abierto) => !abierto)}
            className={BOTON_FILTROS}
          >
            Filtros{activos > 0 ? ` (${activos})` : ""}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={panelAbierto ? "rotate-180" : ""}
            />
          </button>

          {/* Con el aviso de "sin resultados" el botón ya está allí: no hay
              dos botones con el mismo nombre a la vez. */}
          {activos > 0 && !sinResultados && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className={BOTON_FILTROS}
            >
              Limpiar filtros
            </button>
          )}

          {/* [E04-HU03/CA07] `disabled` nativo SOLO sin filas visibles. Mientras
              exporta se usa `aria-disabled` para que el foco se quede en el
              botón. El estado deshabilitado no depende solo del color: borde
              discontinuo, cursor de "no permitido" y, al exportar, el texto
              cambia y gira un icono (solo si la persona acepta animaciones). */}
          <button
            type="button"
            onClick={exportar}
            disabled={sinResultados}
            aria-disabled={exportando || undefined}
            aria-busy={exportando}
            title={sinResultados ? "No hay metas para exportar" : undefined}
            className={`${BOTON_FILTROS} disabled:cursor-not-allowed disabled:border-dashed disabled:bg-gray-50 disabled:text-gray-500 aria-disabled:cursor-progress aria-disabled:bg-gray-50`}
          >
            {exportando ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="motion-safe:animate-spin"
              />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            {exportando ? "Generando archivo…" : "Exportar a Excel"}
          </button>

          <BotonCompararCortes
            vigencia={datos.vigencia}
            cortes={cortesListos ? cortes.datos : null}
            error={cortesListos ? cortes.error : null}
          />

          {/* La región live existe SIEMPRE: una región que se monta ya con
              el texto no se anuncia. */}
          <p
            aria-live="polite"
            aria-atomic="true"
            className="ml-auto text-sm font-medium text-gray-700"
          >
            Mostrando {filasVisibles.length} de {datos.filas.length} metas
          </p>
        </div>

        {/* [E04-HU03] Un solo canal por resultado: el éxito, en una región
            `aria-live` siempre montada; el error, solo con `role="alert"`
            (que se anuncia al aparecer). */}
        <p
          aria-live="polite"
          className={`flex items-center gap-2 text-sm font-medium text-green-800 ${mensajeExito ? "mt-3" : ""}`}
        >
          {mensajeExito && (
            <>
              <CircleCheck size={16} aria-hidden="true" className="shrink-0" />
              <span>{mensajeExito}</span>
            </>
          )}
        </p>
        {mensajeError && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            <CircleAlert
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            />
            <span>{mensajeError}</span>
          </p>
        )}

        <FiltrosPlanAccion
          filtros={filtros}
          textoMeta={textoMeta}
          opcionesSector={sectores}
          opcionesIndicador={indicadores}
          estadosCruce={ESTADOS_PARA_FILTRO}
          abierto={panelAbierto}
          idPanel={idPanel}
          refBotonFiltros={refBotonFiltros}
          onAgregar={agregarFiltro}
          onQuitar={quitarFiltro}
          onCambiarTextoMeta={cambiarTextoMeta}
          onAlternarEstado={alternarEstado}
        />
      </Card>

      {sinResultados ? (
        <Vacio
          titulo="No hay metas que cumplan los filtros seleccionados"
          accion={
            <button
              type="button"
              onClick={limpiarFiltros}
              className={BOTON_FILTROS}
            >
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <Leyenda />
      )}

      {/* La tabla no se desmonta sin resultados, solo se oculta: conserva
          sus filas abiertas. */}
      <Card padding="p-0" className="overflow-hidden" hidden={sinResultados}>
        <div ref={refScroll} className="max-h-[70vh] overflow-auto">
          <TablaPlan filas={filasVisibles} />
        </div>
        <p className="border-t border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
          Total: {resumen.total} | Completo: {resumen.completo} | Parcial:{" "}
          {resumen.parcial} | Sin información: {resumen.sin_informacion}
        </p>
      </Card>
    </>
  );
}

export default function PlanAccion() {
  const [intento, setIntento] = useState(0);
  // `clave` identifica a qué intento pertenece lo guardado: mientras no
  // coincida con `intento`, la petición sigue en curso. El único setState del
  // efecto ocurre dentro de los callbacks de la promesa.
  const [resultado, setResultado] = useState({
    clave: null,
    datos: null,
    error: null,
  });

  useEffect(() => {
    let vigente = true;

    api
      .planAccionActual()
      .then((datos) => {
        if (vigente) setResultado({ clave: intento, datos, error: null });
      })
      .catch((error) => {
        if (vigente) setResultado({ clave: intento, datos: null, error });
      });

    return () => {
      vigente = false;
    };
  }, [intento]);

  const cargando = resultado.clave !== intento;
  const { datos, error } = resultado;

  if (cargando) {
    return (
      <section className="mx-auto max-w-[1400px]">
        <Cargando mensaje="Cargando el Plan de Acción…" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-4xl">
        <ErrorPlan
          error={error}
          onReintentar={() => setIntento((n) => n + 1)}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1400px]">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-gray-800">Plan de Acción</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          Corte de vigencia {datos.vigencia}, fecha{" "}
          <span className="font-mono">{fechaCorte(datos.fecha_corte)}</span>.
        </p>
      </header>

      {datos.filas.length === 0 ? (
        <Vacio
          titulo="El corte no tiene metas"
          descripcion="El corte actual no registra ninguna meta en el Plan de Acción."
        />
      ) : (
        <ContenidoPlan datos={datos} />
      )}
    </section>
  );
}
