/**
 * Metas con menos del 50 % de avance financiero.
 *
 * TARJETA: [E-04/HU-07] FE - Visualizar metas con menos del 50 % de avance
 * financiero. CUBRE: HU07-CA01 a CA05 y CA07.
 * FUERA DE ALCANCE: CA06 pide "Responsable", bloqueado por la decisión #14
 * del levantamiento; el backend aún no lo entrega y aquí no se inventa.
 *
 * El backend decide todo: qué metas entran (< 50 %, CA01/CA03), el %
 * (CA02), el orden de menor a mayor (CA05) y cuántas quedan fuera por no
 * tener presupuesto (CA04, `metas_sin_presupuesto`). Esta pantalla solo lo
 * muestra; no recalcula ni reordena.
 *
 * DECISIÓN DEL PO (2026-11-11): una meta con presupuesto y sin dato de
 * ejecución entra con 0 % y la marca "Sin ejecución registrada"
 * (`sin_ejecucion_registrada`). La marca es una insignia con texto, no solo
 * color, para distinguirla de un 0 % que sí viene en el archivo.
 */
import { CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ErrorApi } from "../api/cliente.js";
import { Cargando, EstadoError, Vacio } from "../components/Estados.jsx";
import Card from "../components/shared/Card.jsx";
import EncabezadoPantalla from "../components/shared/EncabezadoPantalla.jsx";
import Pildora from "../components/shared/Pildora.jsx";
import { TD, TH, fondoDeFila } from "../components/shared/estilosTabla.js";
import { cop, fechaCorte, numero, pct } from "../lib/formato.js";

function respuestaValida(datos) {
  return (
    datos &&
    Array.isArray(datos.filas) &&
    typeof datos.fecha_corte === "string" &&
    Number.isInteger(datos.total_en_riesgo) &&
    Number.isInteger(datos.metas_sin_presupuesto)
  );
}

function Celda({ valor, formato = (v) => v, mono = false, derecha = false }) {
  const vacio = valor === null || valor === undefined;
  return (
    <td
      className={`${TD} ${derecha ? "whitespace-nowrap text-right" : ""} ${
        vacio ? "text-gray-600" : ""
      }`}
    >
      {vacio ? (
        <span aria-label="Sin dato">—</span>
      ) : (
        <span className={mono ? "font-mono" : ""}>{formato(valor)}</span>
      )}
    </td>
  );
}

function TablaRiesgo({ filas }) {
  return (
    <div className="overflow-x-auto rounded-tarjeta border border-gray-200 bg-white shadow-suave">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">
          Metas con menos del 50 % de avance financiero, de menor a mayor avance
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Meta
            </th>
            <th scope="col" className={TH}>
              Sector
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Presupuesto definitivo
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Ejecución
            </th>
            <th scope="col" className={`${TH} text-right`}>
              % avance financiero
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr
              key={fila.cod_indicador_producto}
              className={fondoDeFila(indice)}
            >
              <td className={TD}>
                <div className="font-mono">{fila.cod_indicador_producto}</div>
                {fila.nombre_producto && (
                  <div className="mt-1 max-w-md text-gray-700">
                    {fila.nombre_producto}
                  </div>
                )}
              </td>
              <Celda valor={fila.sector} />
              <Celda
                valor={fila.presupuesto_definitivo}
                formato={(v) => cop(Number(v))}
                mono
                derecha
              />
              <Celda
                valor={fila.ejecucion}
                formato={(v) => cop(Number(v))}
                mono
                derecha
              />
              <td className={`${TD} whitespace-nowrap text-right`}>
                <span className="font-mono font-medium">
                  {pct(fila.avance_financiero_pct)}
                </span>
                {fila.sin_ejecucion_registrada && (
                  <div className="mt-1">
                    <Pildora
                      texto="Sin ejecución registrada"
                      tono="ambar"
                      icono={CircleAlert}
                    />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorRiesgo({ error, onReintentar }) {
  if (error.estado === 404) {
    return (
      <Vacio
        titulo="Aún no hay cortes finalizados para consultar"
        descripcion="Las metas en riesgo se calculan con el corte registrado más reciente."
      />
    );
  }
  if (error.estado === 403) {
    return (
      <Vacio
        titulo="No tiene permiso para ver las metas en riesgo"
        descripcion="Su rol no tiene acceso a este módulo."
      />
    );
  }
  return <EstadoError error={error} onReintentar={onReintentar} />;
}

export default function MetasEnRiesgo() {
  const [intento, setIntento] = useState(0);
  // `clave` dice a qué intento pertenece lo guardado: mientras no coincida con
  // `intento` la petición sigue en curso (mismo patrón de `PlanAccion.jsx`).
  const [resultado, setResultado] = useState({
    clave: null,
    datos: null,
    error: null,
  });

  useEffect(() => {
    let vigente = true;
    api
      .metasEnRiesgo()
      .then((datos) => {
        if (!respuestaValida(datos)) {
          throw new ErrorApi("La respuesta del servidor no es válida.", {
            codigo: "respuesta_invalida",
          });
        }
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
        <EncabezadoPantalla titulo="Metas en riesgo" />
        <Cargando mensaje="Cargando las metas en riesgo…" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-4xl">
        <EncabezadoPantalla titulo="Metas en riesgo" />
        <ErrorRiesgo
          error={error}
          onReintentar={() => setIntento((n) => n + 1)}
        />
      </section>
    );
  }

  const umbral = numero(datos.umbral_pct);

  return (
    <section className="mx-auto max-w-[1400px]">
      <EncabezadoPantalla
        titulo="Metas en riesgo"
        descripcion={
          <>
            Metas con menos del {umbral} % de avance financiero. Corte de
            vigencia {datos.vigencia}, fecha{" "}
            <span className="font-mono">{fechaCorte(datos.fecha_corte)}</span>.
          </>
        }
      />

      <Card as="section" className="mb-4">
        <p className="text-campo text-gray-700" aria-live="polite">
          <span className="font-semibold">{datos.total_en_riesgo}</span>{" "}
          {datos.total_en_riesgo === 1 ? "meta en riesgo" : "metas en riesgo"}
          {datos.metas_sin_presupuesto > 0 && (
            <>
              {" · "}
              <span className="font-semibold">
                {datos.metas_sin_presupuesto}
              </span>{" "}
              {datos.metas_sin_presupuesto === 1 ? "meta" : "metas"} sin
              presupuesto (no se listan)
            </>
          )}
        </p>
      </Card>

      {datos.filas.length === 0 ? (
        <Vacio titulo="No hay metas en riesgo en este corte" />
      ) : (
        <TablaRiesgo filas={datos.filas} />
      )}
    </section>
  );
}
