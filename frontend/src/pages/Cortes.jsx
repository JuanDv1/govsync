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
 * D24 (docs/DECISIONES.md): "Crear corte" (estado vacío) y "Continuar
 * carga" (fila en BORRADOR) solo se muestran si `puedeEscribir`
 * (administrador/gestor) — son acciones de escritura, igual que el "Nuevo
 * corte" que `Disposicion.jsx` ya oculta para `visitante`. Es solo UI: el
 * backend ya las rechaza con 403 de todas formas.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/cliente.js";
import { useAutenticacion } from "../auth/ProveedorAutenticacion.jsx";
import { Cargando, EstadoError, Vacio } from "../components/Estados.jsx";
import Card from "../components/shared/Card.jsx";
import StateBadge from "../components/shared/StateBadge.jsx";

const TONO_ESTADO_CORTE = {
  BORRADOR: "gris",
  REGISTRADO: "verde",
};

/** D24: "Continuar carga" (escritura) solo si puedeEscribir — ver docstring. */
function accionDeCorte(corte, puedeEscribir) {
  if (corte.estado === "REGISTRADO") {
    return (
      <Link
        to={`/matriz/${corte.id}`}
        className="text-[11px] font-medium text-azul hover:text-navy"
      >
        Ver matriz
      </Link>
    );
  }

  if (puedeEscribir) {
    return (
      <Link
        to={`/cortes/${corte.id}`}
        className="text-[11px] font-medium text-azul hover:text-navy"
      >
        Continuar carga
      </Link>
    );
  }

  return <span className="text-[11px] text-gray-400">En borrador</span>;
}

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
        <p className="mt-0.5 text-[11px] text-gray-500">
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
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {titulo}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {cortes.map((corte) => (
                <tr
                  key={corte.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                    {corte.fecha_corte}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">
                    {corte.vigencia}
                  </td>
                  <td className="px-4 py-2.5">
                    <StateBadge
                      texto={corte.estado}
                      tono={TONO_ESTADO_CORTE[corte.estado] ?? "gris"}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                    {corte.archivos?.length ?? 0} de 3
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {accionDeCorte(corte, puedeEscribir)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
