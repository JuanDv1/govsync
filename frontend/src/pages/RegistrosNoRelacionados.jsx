/**
 * Registros no relacionados del cruce (alertas de cruce).
 *
 * TARJETA: [E-04/HU-05] FE - Visualizar registros no relacionados. CUBRE:
 * HU05-CA01 a CA07.
 *
 * El backend decide todo: qué registros no se relacionaron, el motivo (catálogo
 * cerrado, con su etiqueta), los filtros, el total y los conteos por fuente.
 * Esta pantalla solo los muestra: no recalcula ni traduce nada (por eso las
 * etiquetas de fuente y motivo vienen de `opciones-filtro` y de cada fila).
 *
 * CORTE: la ruta es `/registros-no-relacionados/:corteId?`. Sin `corteId` se
 * usa el corte actual (el REGISTRADO más reciente, según `GET /cortes`).
 *
 * Una fila por (registro, motivo): un mismo código puede salir en varias filas
 * con motivos distintos. `valor` solo existe en rubros y contratos; en meta y
 * proyecto la celda queda vacía, nunca "0".
 *
 * Filtros: dos criterios (Fuente y Motivo) con `SelectorConBusqueda` y las
 * etiquetas activas de `ListaEtiquetasFiltro`, igual que HU-10. Cambiar un
 * filtro vuelve a la página 1. El estado pagina/filtros vive aquí; la respuesta
 * se guarda con la clave de la consulta que la produjo, así que una respuesta
 * lenta de una consulta anterior nunca pisa a la actual.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ErrorApi } from "../api/cliente.js";
import BotonExportar from "../components/BotonExportarExcel.jsx";
import { Cargando, EstadoError, Vacio } from "../components/Estados.jsx";
import Boton from "../components/shared/Boton.jsx";
import Card from "../components/shared/Card.jsx";
import EncabezadoPantalla from "../components/shared/EncabezadoPantalla.jsx";
import ListaEtiquetasFiltro from "../components/shared/ListaEtiquetasFiltro.jsx";
import SelectorConBusqueda from "../components/shared/SelectorConBusqueda.jsx";
import { TD, TH, fondoDeFila } from "../components/shared/estilosTabla.js";
import { esCorteActual } from "../lib/corteActual.js";
import { cop, fechaCorte, numero } from "../lib/formato.js";

const TAMANO_PAGINA = 50;
const CRITERIOS = [
  { clave: "fuente", titulo: "Fuente", opciones: "fuentes" },
  { clave: "motivo", titulo: "Motivo", opciones: "motivos" },
];
const SIN_FILTROS = { fuente: [], motivo: [] };

function hayFiltros(filtros) {
  return CRITERIOS.some((c) => filtros[c.clave].length > 0);
}

function respuestaValida(datos) {
  return (
    datos &&
    Array.isArray(datos.filas) &&
    Number.isInteger(datos.total) &&
    datos.conteos_por_fuente &&
    typeof datos.conteos_por_fuente === "object" &&
    typeof datos.fecha_corte === "string"
  );
}

function opcionesValidas(datos) {
  return datos && Array.isArray(datos.fuentes) && Array.isArray(datos.motivos);
}

function mensajeErrorExportar(error) {
  if (error?.estado === 409 || error?.estado === 404) {
    return "El corte ya no se puede exportar. Actualice la pantalla.";
  }
  if (error?.codigo === "error_red") {
    return "No se pudo conectar con el servidor. Intente de nuevo.";
  }
  return "No se pudo generar el archivo. Intente de nuevo.";
}

/** Carga un recurso y guarda el resultado con la clave que lo pidió. */
function useCarga(clave, pedir, esValido) {
  const [resultado, setResultado] = useState({
    clave: null,
    datos: null,
    error: null,
  });
  useEffect(() => {
    if (clave === null) return undefined;
    let vigente = true;
    pedir()
      .then((datos) => {
        if (!esValido(datos)) {
          throw new ErrorApi("La respuesta del servidor no es válida.", {
            codigo: "respuesta_invalida",
          });
        }
        if (vigente) setResultado({ clave, datos, error: null });
      })
      .catch((error) => {
        if (vigente) setResultado({ clave, datos: null, error });
      });
    return () => {
      vigente = false;
    };
    // `pedir` y `esValido` cambian en cada render; `clave` identifica la consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return {
    cargando: clave !== null && resultado.clave !== clave,
    datos: resultado.clave === clave ? resultado.datos : null,
    error: resultado.clave === clave ? resultado.error : null,
  };
}

function Filtros({ opciones, filtros, onAgregar, onQuitar }) {
  const textos = new Map(
    CRITERIOS.flatMap((c) =>
      opciones[c.opciones].map((o) => [`${c.clave}:${o.valor}`, o.etiqueta]),
    ),
  );
  const etiquetas = CRITERIOS.flatMap((c) =>
    filtros[c.clave].map((valor) => ({
      clave: c.clave,
      titulo: c.titulo,
      valor,
      texto: textos.get(`${c.clave}:${valor}`) ?? valor,
    })),
  );
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {CRITERIOS.map((c) => (
          <SelectorConBusqueda
            key={c.clave}
            etiqueta={c.titulo}
            opciones={opciones[c.opciones].map((o) => ({
              valor: o.valor,
              texto: o.etiqueta,
            }))}
            seleccionados={filtros[c.clave]}
            onAgregar={(valor) => onAgregar(c.clave, valor)}
            placeholder="Buscar…"
            tamano="grande"
          />
        ))}
      </div>
      <ListaEtiquetasFiltro etiquetas={etiquetas} onQuitar={onQuitar} />
    </div>
  );
}

function Contador({ datos, fuentes }) {
  const etiquetaDe = new Map(fuentes.map((f) => [f.valor, f.etiqueta]));
  return (
    <p className="text-campo text-gray-700" aria-live="polite">
      <span className="font-semibold">{numero(datos.total)}</span>{" "}
      {datos.total === 1
        ? "registro no relacionado"
        : "registros no relacionados"}
      {Object.entries(datos.conteos_por_fuente).map(([fuente, cantidad]) => (
        <span key={fuente}>
          {" · "}
          {etiquetaDe.get(fuente) ?? fuente}:{" "}
          <span className="font-semibold">{numero(cantidad)}</span>
        </span>
      ))}
    </p>
  );
}

function Tabla({ filas }) {
  return (
    <div className="overflow-x-auto rounded-tarjeta border border-gray-200 bg-white shadow-suave">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">
          Registros que no pudieron relacionarse en el cruce
        </caption>
        <thead>
          <tr>
            {["Fuente", "Código", "Descripción"].map((t) => (
              <th key={t} scope="col" className={TH}>
                {t}
              </th>
            ))}
            <th scope="col" className={`${TH} text-right`}>
              Valor
            </th>
            <th scope="col" className={TH}>
              Motivo
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr
              key={`${fila.fuente}:${fila.codigo}:${fila.motivo}:${indice}`}
              className={fondoDeFila(indice)}
            >
              <td className={TD}>{fila.fuente_etiqueta}</td>
              <td className={TD}>
                {fila.codigo === null ? (
                  <span className="text-gray-600" aria-label="Sin código">
                    —
                  </span>
                ) : (
                  <span className="font-mono">{fila.codigo}</span>
                )}
              </td>
              <td className={TD}>
                {fila.descripcion ?? (
                  <span className="text-gray-600" aria-label="Sin descripción">
                    —
                  </span>
                )}
              </td>
              <td className={`${TD} whitespace-nowrap text-right`}>
                {fila.valor === null ? null : (
                  <span className="font-mono">{cop(Number(fila.valor))}</span>
                )}
              </td>
              <td className={TD}>{fila.motivo_etiqueta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Paginacion({ pagina, totalPaginas, cargando, onCambiar }) {
  if (totalPaginas <= 1) return null;
  return (
    <nav
      className="mt-3 flex items-center justify-center gap-4"
      aria-label="Paginación de registros no relacionados"
    >
      <Boton
        variante="secundario"
        onClick={() => onCambiar(pagina - 1)}
        deshabilitado={pagina <= 1 || cargando}
      >
        Anterior
      </Boton>
      <span className="text-ayuda text-gray-600" aria-live="polite">
        Página {pagina} de {totalPaginas}
        {cargando ? " · actualizando…" : ""}
      </span>
      <Boton
        variante="secundario"
        onClick={() => onCambiar(pagina + 1)}
        deshabilitado={pagina >= totalPaginas || cargando}
      >
        Siguiente
      </Boton>
    </nav>
  );
}

function ErrorRegistros({ error, onReintentar }) {
  if (error.estado === 403) {
    return (
      <Vacio
        titulo="No tiene permiso para ver los registros no relacionados"
        descripcion="Su rol no tiene acceso a este módulo."
      />
    );
  }
  // 404 (corte inexistente) y 409 (BORRADOR o fuentes incompletas): el mensaje
  // del backend y `detalles.archivos_faltantes` ya los explica `EstadoError`.
  return <EstadoError error={error} onReintentar={onReintentar} />;
}

function Contenido({ corteId }) {
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [exportando, setExportando] = useState(false);

  const opciones = useCarga(
    `opciones:${intento}`,
    () => api.opcionesNoRelacionados(),
    opcionesValidas,
  );
  const clave = `${corteId}:${pagina}:${intento}:${JSON.stringify(filtros)}`;
  const registros = useCarga(
    clave,
    () => api.registrosNoRelacionados(corteId, filtros, pagina, TAMANO_PAGINA),
    respuestaValida,
  );

  // Los datos de la consulta anterior se siguen mostrando mientras llega la
  // nueva (sin parpadeo); un error de la actual los reemplaza.
  const [ultimos, setUltimos] = useState(null);
  if (registros.datos && registros.datos !== ultimos)
    setUltimos(registros.datos);

  const reintentar = () => setIntento((n) => n + 1);

  if (registros.error) {
    return (
      <section className="mx-auto max-w-4xl">
        <EncabezadoPantalla titulo="Registros no relacionados" />
        <ErrorRegistros error={registros.error} onReintentar={reintentar} />
      </section>
    );
  }
  if (!ultimos) {
    return (
      <section className="mx-auto max-w-[1400px]">
        <EncabezadoPantalla titulo="Registros no relacionados" />
        <Cargando mensaje="Cargando los registros no relacionados…" />
      </section>
    );
  }

  const datos = ultimos;
  const actualizando = registros.cargando;
  const totalPaginas = Math.max(
    1,
    Math.ceil(datos.total / datos.tamano_pagina),
  );
  const fuentes = opciones.datos?.fuentes ?? [];
  const filtrado = hayFiltros(filtros);

  function cambiarFiltros(nuevos) {
    setFiltros(nuevos);
    setPagina(1);
  }

  return (
    <section className="mx-auto max-w-[1400px]">
      <EncabezadoPantalla
        titulo="Registros no relacionados"
        descripcion={
          <>
            Registros del cruce que requieren revisión manual. Corte de vigencia{" "}
            {datos.vigencia}, fecha{" "}
            <span className="font-mono">{fechaCorte(datos.fecha_corte)}</span>.
          </>
        }
        acciones={
          <BotonExportar
            key={clave}
            descargar={() => api.exportarNoRelacionados(corteId, filtros)}
            nombreRespaldo={`registros-no-relacionados-${datos.vigencia}.xlsx`}
            mensajeDeError={mensajeErrorExportar}
            deshabilitado={datos.total === 0 || actualizando}
            tituloDeshabilitado="No hay registros para exportar"
            alineacion="fin"
            alCambiarExportando={setExportando}
          />
        }
      />

      <Card as="section" className="mb-4">
        {opciones.datos ? (
          <Filtros
            opciones={opciones.datos}
            filtros={filtros}
            onAgregar={(c, valor) =>
              cambiarFiltros({ ...filtros, [c]: [...filtros[c], valor] })
            }
            onQuitar={(c, valor) =>
              cambiarFiltros({
                ...filtros,
                [c]: filtros[c].filter((v) => v !== valor),
              })
            }
          />
        ) : opciones.error ? (
          <EstadoError error={opciones.error} onReintentar={reintentar} />
        ) : (
          <Cargando mensaje="Cargando los filtros…" />
        )}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <Contador datos={datos} fuentes={fuentes} />
        </div>
      </Card>

      {datos.total === 0 ? (
        filtrado ? (
          <Vacio
            titulo="Ningún registro coincide con los filtros"
            descripcion="Quite algún filtro para ver más resultados."
          />
        ) : (
          <Vacio titulo="Todos los registros se relacionaron correctamente" />
        )
      ) : (
        <div aria-busy={actualizando || exportando}>
          <Tabla filas={datos.filas} />
          <Paginacion
            pagina={datos.pagina}
            totalPaginas={totalPaginas}
            cargando={actualizando}
            onCambiar={setPagina}
          />
        </div>
      )}
    </section>
  );
}

/** Sin `:corteId`, usa el corte actual: el REGISTRADO más reciente. */
function CorteActual() {
  const cortes = useCarga("cortes", () => api.listarCortes(), Array.isArray);
  const [reintento, setReintento] = useState(0);
  if (cortes.error) {
    return (
      <section className="mx-auto max-w-4xl">
        <EncabezadoPantalla titulo="Registros no relacionados" />
        <EstadoError
          error={cortes.error}
          onReintentar={() => setReintento((n) => n + 1)}
        />
      </section>
    );
  }
  if (cortes.cargando || !cortes.datos) {
    return (
      <section className="mx-auto max-w-[1400px]">
        <EncabezadoPantalla titulo="Registros no relacionados" />
        <Cargando mensaje="Buscando el corte actual…" />
      </section>
    );
  }
  const actual = cortes.datos.find((c) => esCorteActual(c, cortes.datos));
  if (!actual) {
    return (
      <section className="mx-auto max-w-4xl">
        <EncabezadoPantalla titulo="Registros no relacionados" />
        <Vacio
          titulo="Aún no hay cortes finalizados para consultar"
          descripcion="Los registros no relacionados se calculan sobre un corte registrado."
        />
      </section>
    );
  }
  return <Contenido key={`${actual.id}:${reintento}`} corteId={actual.id} />;
}

export default function RegistrosNoRelacionados() {
  const { corteId } = useParams();
  return corteId ? (
    <Contenido key={corteId} corteId={corteId} />
  ) : (
    <CorteActual />
  );
}
