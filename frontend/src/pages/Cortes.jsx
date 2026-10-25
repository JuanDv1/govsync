/**
 * Histórico de cortes de seguimiento.
 *
 * TARJETA: [HU-01][FE-03] Panel de fuentes obligatorias y reutilizadas
 * CUBRE: HU-01 / CA-4 (el corte registrado aparece en el histórico)
 *
 * El backend ya entrega los cortes ordenados por fecha de corte y fecha de
 * creación descendentes. Esta pantalla conserva ese orden y no duplica la
 * regla de negocio en frontend.
 *
 * [E02-HU05] "Corte actual" (el que admite "Editar"): el criterio vive en
 * `lib/corteActual.js`, compartido con `EditarArchivosCorteActual.jsx` —
 * antes cada pantalla lo calculaba por su cuenta y podían no coincidir
 * sobre el mismo corte.
 *
 * D24 (docs/DECISIONES.md): "Crear corte" (estado vacío), "Continuar
 * carga" (fila en BORRADOR, corte que no es el actual) y "Editar archivos"
 * (corte actual REGISTRADO) solo se muestran si `puedeEscribir`
 * (administrador/gestor) — son acciones de escritura, igual que el "Nuevo
 * corte" que `Disposicion.jsx` ya oculta para `visitante`. "Ver matriz" y la
 * etiqueta "Actual" los ven los tres roles. Es solo UI: el backend ya
 * rechaza las escrituras con 403 de todas formas.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/cliente.js";
import { useAutenticacion } from "../auth/ProveedorAutenticacion.jsx";
import { Cargando, EstadoError, Vacio } from "../components/Estados.jsx";
import Card from "../components/shared/Card.jsx";
import StateBadge from "../components/shared/StateBadge.jsx";
import { esCorteActual } from "../lib/corteActual.js";

const TONO_ESTADO_CORTE = {
  BORRADOR: "gris",
  REGISTRADO: "verde",
};

export default function Cortes() {
  const { puedeEscribir } = useAutenticacion();
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState({
    clave: null,
    datos: null,
    error: null,
  });

  useEffect(() => {
    const clave = intento;
    let vigente = true;

    api
      .listarCortes()
      .then((datos) => {
        if (vigente) setResultado({ clave, datos, error: null });
      })
      .catch((errorApi) => {
        if (vigente) setResultado({ clave, datos: null, error: errorApi });
      });

    return () => {
      vigente = false;
    };
  }, [intento]);

  const cargando = resultado.clave !== intento;
  const error = resultado.clave === intento ? resultado.error : null;
  const cortes = resultado.clave === intento ? resultado.datos : null;

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  return (
    <section className="mx-auto max-w-4xl">
      <header className="mb-5">
        <h1 className="text-base font-semibold text-gray-800">
          Histórico de cortes
        </h1>
        <p className="mt-0.5 text-ayuda text-gray-600">
          Cortes de seguimiento creados hasta ahora, más reciente primero.
        </p>
      </header>

      {cargando && <Cargando mensaje="Cargando histórico de cortes…" />}

      {!cargando && error && (
        <EstadoError error={error} onReintentar={reintentar} />
      )}

      {!cargando && !error && (!cortes || cortes.length === 0) && (
        <Vacio
          titulo="No hay cortes todavía"
          descripcion={
            puedeEscribir
              ? "Crea un corte de seguimiento para iniciar el histórico."
              : "Todavía no se ha creado ningún corte de seguimiento."
          }
          accion={
            puedeEscribir ? (
              <Link
                to="/cortes/nuevo"
                className="text-xs font-medium text-azul hover:text-navy"
              >
                Crear corte
              </Link>
            ) : null
          }
        />
      )}

      {!cargando && !error && cortes && cortes.length > 0 && (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["Fecha de corte", "Vigencia", "Estado", "Fuentes", ""].map(
                  (titulo) => (
                    <th
                      key={titulo}
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                    >
                      {titulo}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {cortes.map((corte) => {
                const actual = esCorteActual(corte, cortes);

                return (
                  <tr
                    key={corte.id}
                    className={`border-b border-gray-100 last:border-0 ${
                      actual
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "hover:bg-gray-50/60"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      {corte.fecha_corte}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700">
                      {corte.vigencia}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <StateBadge
                          texto={corte.estado}
                          tono={TONO_ESTADO_CORTE[corte.estado] ?? "gris"}
                        />
                        {/* [E02-HU05] Etiqueta "Actual" — mismo criterio que
                            habilita el botón "Editar" de la última columna. */}
                        {actual && <StateBadge texto="Actual" tono="azul" />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      {corte.archivos?.length ?? 0} de 3
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {corte.estado === "REGISTRADO" ? (
                        <span className="inline-flex items-center gap-3">
                          <Link
                            to={`/matriz/${corte.id}`}
                            className="text-campo font-medium text-azul hover:text-navy"
                          >
                            Ver matriz
                          </Link>
                          {/* [E02-HU05/CA-1]: "Editar archivos" es el texto
                              literal del criterio de aceptación. Solo el
                              corte actual (el más reciente, global) lo
                              ofrece — ver `esCorteActual()` arriba para el
                              criterio (campo `es_corte_actual` del backend,
                              con respaldo por posición solo si falta). Solo
                              con `puedeEscribir` (D24): el visitante sigue
                              viendo "Ver matriz". */}
                          {actual && puedeEscribir && (
                            <Link
                              to={`/cortes/${corte.id}/editar`}
                              className="text-campo font-medium text-azul hover:text-navy"
                            >
                              Editar archivos
                            </Link>
                          )}
                        </span>
                      ) : puedeEscribir ? (
                        // D24: "Continuar carga" es una acción de escritura
                        // -- mismo criterio que accionDeCorte() usaba antes
                        // de que esta pantalla ganara esCorteActual()/badge.
                        <Link
                          to={`/cortes/${corte.id}`}
                          className="text-campo font-medium text-azul hover:text-navy"
                        >
                          Continuar carga
                        </Link>
                      ) : (
                        <span className="text-ayuda text-gray-600">
                          En borrador
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
