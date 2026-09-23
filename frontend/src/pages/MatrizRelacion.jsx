/**
 * Matriz de relación del corte.
 *
 * TARJETAS: [HU-07][FE-02] Tabla de la matriz de relación
 *           [HU-07][FE-03] Representación explícita de la información no relacionada
 *           [HU-07][FE-04] Integración y rendimiento de la tabla
 *
 * ALCANCE DE FE-02 (CA-3 a CA-6): tabla con las seis columnas confirmadas
 * (código BPIN, indicador y/o producto, ejecución, contrato).
 *
 * CORRECCIÓN DE CONTRATO (2026-09-19, actualizada 2026-09-21): esta nota
 * decía que el backend envía las columnas junto con los datos. No es así:
 * `GET /matriz-relacion/{id}` (`trazabilidad/api/router.py::MatrizRespuesta`)
 * solo devuelve `filas`. El router llegó a tener una constante `COLUMNAS`
 * pensada para centralizar este contrato, pero nunca se usó (código muerto)
 * y se borró el 2026-09-21 (ver docs/TRAZABILIDAD.md). Los encabezados de
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
 * ALCANCE DE FE-04 (tarjeta Trello, sin CA propio en PLANDETRABAJO.md —
 * ver docs/TRAZABILIDAD.md/CA-1 para la evidencia; CA-2 es un contrato
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
 *   (docs/TRAZABILIDAD.md): validación manual en navegador contra el
 *   backend real, con el corte de referencia de docs/DECISIONES.md D4.
 *   Agregar infraestructura de pruebas de frontend es una decisión de
 *   arquitectura propia que el equipo debe tomar explícitamente en una
 *   tarjeta dedicada — no se introduce aquí de forma silenciosa.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api/cliente.js";
import {
  Cargando,
  Error as EstadoError,
  SinCorrespondencia,
  Vacio,
} from "../components/Estados.jsx";
import Card from "../components/shared/Card.jsx";

//: Mismo orden y claves que el contrato confirmado en HU-07/CA-3..CA-6 — ver
//: la nota de corrección de contrato arriba (la constante `COLUMNAS` del
//: router era código muerto y se borró el 2026-09-21).
const COLUMNAS = [
  { clave: "cod_bpin", titulo: "Cód. BPIN" },
  { clave: "cod_indicador_producto", titulo: "Cód. indicador (SisPT)" },
  { clave: "nombre_producto", titulo: "Nombre del producto" },
  { clave: "cod_indicador_ejecucion", titulo: "Cód. indicador (ejecución)" },
  { clave: "numero_contrato", titulo: "Núm. contrato" },
  { clave: "descripcion_contrato", titulo: "Descripción" },
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

function Celda({ clave, valor }) {
  if (valor === null || valor === undefined) {
    return <SinCorrespondencia />;
  }
  return CLAVES_CODIGO.has(clave) ? (
    <span className="codigo">{valor}</span>
  ) : (
    valor
  );
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

      <span aria-live="polite" className="text-[11px] text-gray-500">
        Página {pagina} de {totalPaginas} · {totalFilas} filas en total
        {actualizando ? " · actualizando…" : ""}
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

  // Cambiar de corte es una pantalla distinta: se reinicia la página y se
  // descartan las filas que se estaban mostrando (pertenecen al corte
  // anterior, no tiene sentido conservarlas como "página previa" de otro
  // corte). Ajustar estado cuando cambia una prop se hace DURANTE el render
  // (patrón oficial de React: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
  // no dentro de un efecto — evita el re-render en cascada que marca
  // react-hooks/set-state-in-effect, y evita el parpadeo de un render con
  // datos del corte anterior antes de que el efecto de abajo llegue a
  // limpiarlos.
  const [corteAnterior, setCorteAnterior] = useState(corteId);
  if (corteId !== corteAnterior) {
    setCorteAnterior(corteId);
    setPagina(1);
    setMatrizVisible(null);
  }

  const claveActual = corteId ? `${corteId}:${pagina}:${intento}` : null;

  useEffect(() => {
    if (!corteId) return;

    const clave = `${corteId}:${pagina}:${intento}`;
    let vigente = true;

    api
      .matriz(corteId, pagina, TAMANO_PAGINA)
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
  }, [corteId, pagina, intento]);

  const cargando = Boolean(claveActual) && resultado.clave !== claveActual;
  const error = resultado.clave === claveActual ? resultado.error : null;

  // Carga inicial: todavía no hay ninguna fila que mostrar, así que la
  // pantalla completa de `Cargando` es aceptable (no hay nada montado que
  // preservar). Carga de página siguiente: ya hay `matrizVisible`, así que
  // la tabla se mantiene montada y solo se deshabilitan los controles.
  const cargandoInicial = cargando && matrizVisible === null;
  const actualizandoPagina = cargando && matrizVisible !== null;

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
        matrizVisible.total_filas === 0 && (
          <Vacio
            titulo="Sin datos para mostrar"
            descripcion="Este corte no tiene metas registradas en la matriz de relación."
          />
        )}

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
                </tr>
              </thead>
              <tbody>
                {matrizVisible.filas.map((fila, indice) => (
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
                  </tr>
                ))}
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
