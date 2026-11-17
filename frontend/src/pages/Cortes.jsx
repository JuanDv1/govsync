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
 * (solo administrador, D24/D37) — son acciones de escritura, igual que el "Nuevo
 * corte" que `Disposicion.jsx` ya oculta para `visitante`. "Ver matriz" y la
 * etiqueta "Actual" los ven administrador y visitante. Es solo UI: el backend ya
 * rechaza las escrituras con 403 de todas formas.
 *
 * [E02-HU08/CA03] Columna "Metas": `cantidad_metas` viene del backend
 * (`null` en BORRADOR → "—", nunca 0; un REGISTRADO sin metas muestra 0).
 * Esta pantalla no calcula el número.
 *
 * [E02-HU08/CA04] Estrella del corte de referencia (uno por vigencia). La ven
 * todos los roles con acceso; "Marcar/Quitar referencia" solo con
 * `puedeEscribir` y solo en cortes REGISTRADOS. Tras un PUT/DELETE exitoso se
 * recarga la lista (sin pantalla de carga): el backend mueve la marca dentro
 * de la vigencia y el cliente no lo replica, así nunca hay dos estrellas. Un
 * error (404/409) se muestra y la lista queda como estaba.
 */
import { Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api/cliente.js";
import { useAutenticacion } from "../auth/ProveedorAutenticacion.jsx";
import { Cargando, EstadoError, Vacio } from "../components/Estados.jsx";
import Boton from "../components/shared/Boton.jsx";
import Card from "../components/shared/Card.jsx";
import EncabezadoPantalla from "../components/shared/EncabezadoPantalla.jsx";
import StateBadge from "../components/shared/StateBadge.jsx";
import { TD, TH, fondoDeFila } from "../components/shared/estilosTabla.js";
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

  // [E02-HU08/CA04] `enCurso` (ref) corta el doble clic de forma síncrona: el
  // estado `idEnCurso` solo deshabilita los botones en el siguiente render.
  const enCurso = useRef(false);
  const [idEnCurso, setIdEnCurso] = useState(null);
  const [errorReferencia, setErrorReferencia] = useState(null);

  async function cambiarReferencia(corte) {
    if (enCurso.current) return;
    enCurso.current = true;
    setIdEnCurso(corte.id);
    setErrorReferencia(null);
    try {
      if (corte.es_referencia) {
        await api.desmarcarCorteReferencia(corte.id);
      } else {
        await api.marcarCorteReferencia(corte.id);
      }
    } catch (errorApi) {
      setErrorReferencia(errorApi);
      enCurso.current = false;
      setIdEnCurso(null);
      return;
    }
    try {
      const datos = await api.listarCortes();
      setResultado({ clave: intento, datos, error: null });
    } catch (errorApi) {
      // La marca se aplicó pero no se pudo releer: mostrar la lista vieja
      // podría dejar dos estrellas en una vigencia.
      setResultado({ clave: intento, datos: null, error: errorApi });
    } finally {
      enCurso.current = false;
      setIdEnCurso(null);
    }
  }

  return (
    <section className="mx-auto max-w-5xl">
      <EncabezadoPantalla
        titulo="Histórico de cortes"
        descripcion="Cortes de seguimiento creados hasta ahora, más reciente primero."
      />

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
            puedeEscribir ? <Boton to="/cortes/nuevo">Crear corte</Boton> : null
          }
        />
      )}

      {!cargando && !error && errorReferencia && (
        <div className="mb-4">
          <EstadoError
            error={errorReferencia}
            onReintentar={() => {
              setErrorReferencia(null);
              reintentar();
            }}
          />
        </div>
      )}

      {!cargando && !error && cortes && cortes.length > 0 && (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {[
                  "Fecha de corte",
                  "Vigencia",
                  "Estado",
                  "Fuentes",
                  "Metas",
                  "",
                ].map((titulo) => (
                  <th key={titulo} scope="col" className={TH}>
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cortes.map((corte, indice) => {
                const actual = esCorteActual(corte, cortes);

                return (
                  <tr
                    key={corte.id}
                    className={
                      actual
                        ? "bg-blue-50 hover:bg-blue-100"
                        : fondoDeFila(indice)
                    }
                  >
                    <td className={`${TD} font-mono text-gray-700`}>
                      {corte.fecha_corte}
                    </td>
                    <td className={`${TD} text-gray-700`}>{corte.vigencia}</td>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-1.5">
                        <StateBadge
                          texto={corte.estado}
                          tono={TONO_ESTADO_CORTE[corte.estado] ?? "gris"}
                        />
                        {/* [E02-HU05] Etiqueta "Actual" — mismo criterio que
                            habilita el botón "Editar" de la última columna. */}
                        {actual && <StateBadge texto="Actual" tono="azul" />}
                        {/* [E02-HU08/CA04] Estrella: ícono + texto, no solo
                            color. El texto completo es para lectores de
                            pantalla; a la vista, "Referencia". */}
                        {corte.es_referencia && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-ayuda font-semibold text-amber-900">
                            <Star
                              size={14}
                              aria-hidden="true"
                              className="fill-amber-500 text-amber-600"
                            />
                            <span className="sr-only">
                              Corte de referencia de la vigencia{" "}
                              {corte.vigencia}
                            </span>
                            <span aria-hidden="true">Referencia</span>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={`${TD} font-mono text-gray-700`}>
                      {corte.archivos?.length ?? 0} de 3
                    </td>
                    <td className={`${TD} font-mono text-gray-700`}>
                      {/* [E02-HU08/CA03] `null` = BORRADOR: "—", nunca 0. */}
                      {corte.cantidad_metas == null ? (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">
                            Sin cantidad: el corte está en borrador
                          </span>
                        </>
                      ) : (
                        corte.cantidad_metas
                      )}
                    </td>
                    <td className={`${TD} text-right`}>
                      {corte.estado === "REGISTRADO" ? (
                        <span className="inline-flex items-center gap-3">
                          <Boton
                            variante="secundario"
                            to={`/matriz/${corte.id}`}
                          >
                            Ver matriz
                          </Boton>
                          {/* [E02-HU05/CA-1]: "Editar archivos" es el texto
                              literal del criterio de aceptación. Solo el
                              corte actual (el más reciente, global) lo
                              ofrece — ver `esCorteActual()` arriba para el
                              criterio (campo `es_corte_actual` del backend,
                              con respaldo por posición solo si falta). Solo
                              con `puedeEscribir` (D24): el visitante sigue
                              viendo "Ver matriz". */}
                          {puedeEscribir && (
                            <Boton
                              variante="secundario"
                              icono={Star}
                              deshabilitado={idEnCurso !== null}
                              aria-label={`${
                                corte.es_referencia
                                  ? "Quitar referencia"
                                  : "Marcar referencia"
                              }, corte del ${corte.fecha_corte}`}
                              onClick={() => cambiarReferencia(corte)}
                            >
                              {corte.es_referencia
                                ? "Quitar referencia"
                                : "Marcar referencia"}
                            </Boton>
                          )}
                          {actual && puedeEscribir && (
                            <Boton
                              variante="secundario"
                              to={`/cortes/${corte.id}/editar`}
                            >
                              Editar archivos
                            </Boton>
                          )}
                        </span>
                      ) : puedeEscribir ? (
                        // D24: "Continuar carga" es una acción de escritura
                        // -- mismo criterio que accionDeCorte() usaba antes
                        // de que esta pantalla ganara esCorteActual()/badge.
                        <Boton to={`/cortes/${corte.id}`}>
                          Continuar carga
                        </Boton>
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
