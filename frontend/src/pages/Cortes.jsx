/**
 * Histórico de cortes de seguimiento.
 *
 * TARJETA: [HU-01][FE-03] Panel de fuentes obligatorias y reutilizadas
 * CUBRE: HU-01 / CA-4 (el corte registrado aparece en el histórico)
 *
 * El backend ya entrega los cortes ordenados por fecha de corte y fecha de
 * creación descendentes. Esta pantalla conserva ese orden y no duplica la
 * regla de negocio en frontend.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/cliente.js";
import {
  Cargando,
  Error as EstadoError,
  Vacio,
} from "../components/Estados.jsx";

export default function Cortes() {
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

  if (cargando) {
    return <Cargando mensaje="Cargando histórico de cortes…" />;
  }

  if (error) {
    return <EstadoError error={error} onReintentar={reintentar} />;
  }

  if (!cortes || cortes.length === 0) {
    return (
      <Vacio
        titulo="No hay cortes todavía"
        descripcion="Crea un corte de seguimiento para iniciar el histórico."
        accion={<Link to="/cortes/nuevo">Crear corte</Link>}
      />
    );
  }

  return (
    <section className="historico-cortes">
      <h1>Histórico de cortes</h1>

      <table className="cortes-tabla">
        <thead>
          <tr>
            <th>Fecha de corte</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Fuentes</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {cortes.map((corte) => (
            <tr key={corte.id}>
              <td>{corte.fecha_corte}</td>
              <td>{corte.vigencia}</td>
              <td>{corte.estado}</td>
              <td>{corte.archivos?.length ?? 0} de 3</td>
              <td>
                {corte.estado === "REGISTRADO" ? (
                  <Link to={`/matriz/${corte.id}`}>Ver matriz</Link>
                ) : (
                  <span className="apagado">En borrador</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
