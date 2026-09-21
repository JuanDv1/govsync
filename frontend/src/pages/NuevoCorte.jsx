import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { api } from "../api/cliente.js";
import CargaDeArchivo from "../components/CargaDeArchivo.jsx";
import { Cargando, Error as EstadoError } from "../components/Estados.jsx";
import VistaPreviaDescartes from "../components/VistaPreviaDescartes.jsx";

/**
 * Asistente de creación de un corte.
 *
 * TARJETAS: [HU-01][FE-02] Formulario con calendario restringido
 *           [HU-01][FE-03] Panel de fuentes obligatorias y reutilizadas
 *           [HU-02][FE-02] Pantalla de carga del PDT y confirmación de
 *                           columnas (CA-1, CA-3, CA-4, CA-5) — YA
 *                           IMPLEMENTADO, ver paso 2 abajo.
 *           [HU-03][FE-02] Pantalla de carga presupuestal
 *           [HU-04][FE-02] Carga de la plantilla BPIN (CA-1, CA-2) — YA
 *                           IMPLEMENTADO, ver paso 2 abajo. Tarjeta de Karold, adelantada
 *                           aquí porque no había respuesta de coordinación;
 *                           mismo precedente que sentó Juan Esteban con PDT
 *                           bajo su propia tarjeta [HU-02][FE-02] — revisar
 *                           antes de fusionar.
 *           [HU-04][FE-03] Vista previa de códigos extraídos y descartados —
 *                           YA IMPLEMENTADO (componente `VistaPreviaDescartes`,
 *                           PR #79), integrado aquí en el paso 2 de PROYECTOS.
 *
 * FLUJO
 *   Paso 1  vigencia y fecha — el calendario NO permite fechas futuras (CA-2),
 *           pero el rechazo también debe venir del backend: ocultar la opción
 *           en el frontend no es una validación. Al enviar, el corte creado
 *           (con su `id`) queda en estado local y se avanza al paso 2 — antes
 *           el resultado de `crearCorte` se descartaba; [HU-02][FE-02] es el
 *           primer consumidor real de ese `id`.
 *   Paso 2  carga de los tres archivos obligatorios: PDT ([HU-02][FE-02]),
 *           PROYECTOS ([HU-04][FE-02]/[FE-03], Karold) y EJECUCION
 *           ([HU-03][FE-02]) contra `POST /cortes/{id}/archivos/{tipo}`, que
 *           ya cierra de punta a punta para los tres tipos. [HU-01][FE-03]
 *           muestra las fuentes reutilizadas automáticamente por el backend y
 *           permite reemplazar PDT/PROYECTOS desde los mismos controles.
 *   Paso 3  registrar (`POST /cortes/{id}/registrar`, HU-01/CA-3, CA-4):
 *           solo se habilita cuando las tres fuentes están disponibles
 *           (cargadas o reutilizadas). Al
 *           registrar con éxito se ofrece un enlace directo a la matriz de
 *           relación del corte.
 *
 * [HU-02][FE-02], D15 (docs/DECISIONES.md): el backend distingue solo DOS
 * `detalles.motivo` para el rechazo del PDT — `hoja_no_encontrada` cubre a
 * la vez "pestaña no encontrada" (CA-2) y "archivo incorrecto" (CA-4);
 * `columnas_faltantes` es el único que además trae qué columna falta
 * (CA-3). Se muestra `error.message` del backend tal cual (ya es
 * específico, `EstadoError` ya lo despliega junto con `detalles`), sin
 * fabricar un tercer mensaje propio en este componente. Es un SUPUESTO,
 * pendiente de que el equipo lo confirme — ver D15 para la alternativa
 * descartada.
 */

export default function NuevoCorte() {
  const [vigencia, setVigencia] = useState("");
  const [fechaCorte, setFechaCorte] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [corte, setCorte] = useState(null);
  const [resultadoPdt, setResultadoPdt] = useState(null);
  const [errorPdt, setErrorPdt] = useState(null);
  const [resultadoProyectos, setResultadoProyectos] = useState(null);
  const [errorProyectos, setErrorProyectos] = useState(null);
  const [resultadoEjecucion, setResultadoEjecucion] = useState(null);
  const [errorEjecucion, setErrorEjecucion] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState(null);
  const hoy = new Date();
  const fechaMaxima = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");

  async function manejarEnvio(evento) {
    evento.preventDefault();

    const vigenciaNumerica = Number(vigencia);

    setError(null);
    setEnviando(true);

    try {
      const corteCreado = await api.crearCorte(vigenciaNumerica, fechaCorte);
      setCorte(corteCreado);
    } catch (errorApi) {
      setError(errorApi);
    } finally {
      setEnviando(false);
    }
  }

  // [HU-02][FE-02]: `CargaDeArchivo` nunca captura el error de `onCargar`
  // (solo envuelve el estado "enviando" en un try/finally, ver su
  // docstring) — este componente es quien debe atraparlo y pasarlo de
  // vuelta como prop `error`, nunca dejar que se propague sin manejar.
  async function subirPdt(archivo) {
    setErrorPdt(null);
    try {
      const resultado = await api.cargarArchivo(corte.id, "PDT", archivo);
      setResultadoPdt(resultado);
    } catch (errorApi) {
      setErrorPdt(errorApi);
    }
  }

  // [HU-04][FE-02]: mismo criterio que subirPdt — CargaDeArchivo nunca
  // captura el error de onCargar, este componente lo atrapa y lo pasa de
  // vuelta como prop error.
  async function subirProyectos(archivo) {
    setErrorProyectos(null);
    try {
      const resultado = await api.cargarArchivo(corte.id, "PROYECTOS", archivo);
      setResultadoProyectos(resultado);
    } catch (errorApi) {
      setErrorProyectos(errorApi);
    }
  }

  // [HU-03][FE-02]: mismo criterio que subirPdt/subirProyectos.
  async function subirEjecucion(archivo) {
    setErrorEjecucion(null);
    try {
      const resultado = await api.cargarArchivo(corte.id, "EJECUCION", archivo);
      setResultadoEjecucion(resultado);
    } catch (errorApi) {
      setErrorEjecucion(errorApi);
    }
  }

  async function manejarRegistro() {
    setErrorRegistro(null);
    setRegistrando(true);
    try {
      const corteRegistrado = await api.registrarCorte(corte.id);
      setCorte(corteRegistrado);
    } catch (errorApi) {
      setErrorRegistro(errorApi);
    } finally {
      setRegistrando(false);
    }
  }

  if (corte) {
    const archivos = corte.archivos ?? [];
    const archivoPdt = archivos.find((archivo) => archivo.tipo === "PDT");
    const archivoProyectos = archivos.find(
      (archivo) => archivo.tipo === "PROYECTOS",
    );
    const archivoEjecucion = archivos.find(
      (archivo) => archivo.tipo === "EJECUCION",
    );

    // Si una fuente fue reemplazada durante esta sesión, `resultado*` tiene
    // prioridad sobre el estado inicial recibido al crear el corte.
    const pdtDisponible = Boolean(resultadoPdt || archivoPdt);
    const proyectosDisponibles = Boolean(
      resultadoProyectos || archivoProyectos,
    );
    const ejecucionDisponible = Boolean(resultadoEjecucion || archivoEjecucion);

    const todosCargados =
      pdtDisponible && proyectosDisponibles && ejecucionDisponible;
    const yaRegistrado = corte.estado === "REGISTRADO";

    function estadoFuente(archivo, resultado) {
      if (resultado || (archivo && !archivo.reutilizado)) {
        return "Cargada en este corte";
      }
      if (archivo?.reutilizado) {
        return "Reutilizada del corte anterior";
      }
      return "Pendiente";
    }

    return (
      <section className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-5">
          <h1 className="text-base font-semibold text-gray-800">
            Cargar archivos del corte
          </h1>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Corte de vigencia {corte.vigencia}, fecha{" "}
            <span className="font-mono">{corte.fecha_corte}</span> — estado{" "}
            <span className="font-semibold">{corte.estado}</span>.
          </p>
        </header>

        <div className="mb-5 rounded-sm border border-gray-200 bg-white p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Fuentes obligatorias
          </p>
          <ul
            className="flex flex-col gap-2"
            aria-label="Estado de fuentes obligatorias"
          >
            {[
              ["Plan Indicativo", estadoFuente(archivoPdt, resultadoPdt)],
              [
                "Plantilla de proyectos BPIN",
                estadoFuente(archivoProyectos, resultadoProyectos),
              ],
              [
                "Ejecución presupuestal",
                estadoFuente(archivoEjecucion, resultadoEjecucion),
              ],
            ].map(([etiquetaFuente, estado]) => (
              <li
                key={etiquetaFuente}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-medium text-gray-700">
                  {etiquetaFuente}
                </span>
                <span
                  className={`rounded-sm border px-2 py-0.5 text-[11px] font-medium ${
                    estado === "Cargada en este corte"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : estado === "Reutilizada del corte anterior"
                        ? "border-blue-200 bg-blue-50 text-azul"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  {estado}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <CargaDeArchivo
            tipo="PDT"
            etiqueta="Plan Indicativo"
            cargado={pdtDisponible}
            resultado={
              resultadoPdt &&
              // HU-02/CA-5: "confirma visualmente cuántas metas fueron
              // reconocidas" — `filas_reconocidas` es el conteo genérico que
              // expone `ArchivoFuenteRespuestaParcial`; esta pantalla es la
              // que sabe que para PDT esas filas son "metas" (el componente
              // compartido no lo interpreta, ver su docstring).
              `${resultadoPdt.filas_reconocidas} metas reconocidas.`
            }
            error={errorPdt}
            onCargar={subirPdt}
          />

          <CargaDeArchivo
            tipo="EJECUCION"
            etiqueta="Ejecución presupuestal"
            cargado={ejecucionDisponible}
            resultado={
              resultadoEjecucion &&
              // [HU-03][FE-02]: el backend ya distingue ejecución de
              // contratación (`filas_ejecucion_reconocidas`/
              // `filas_contratacion_reconocidas`, ver cortes/api/router.py) —
              // se muestran por separado en vez del total genérico, que
              // mezclaría dos fuentes distintas en un solo número.
              `${resultadoEjecucion.filas_ejecucion_reconocidas ?? 0} filas de ejecución y ` +
                `${resultadoEjecucion.filas_contratacion_reconocidas ?? 0} de contratación reconocidas.`
            }
            error={errorEjecucion}
            onCargar={subirEjecucion}
          />

          <CargaDeArchivo
            tipo="PROYECTOS"
            etiqueta="Plantilla de proyectos BPIN"
            cargado={proyectosDisponibles}
            resultado={
              resultadoProyectos && (
                <>
                  {/* [HU-04][FE-02]: confirmación del conteo genérico, mismo
                    criterio que ya usa PDT — esta pantalla es la que sabe
                    que para PROYECTOS esas filas son "proyectos". */}
                  <p className="text-xs text-gray-600">
                    {resultadoProyectos.filas_reconocidas} proyectos
                    reconocidos.
                  </p>

                  {/* [HU-04][FE-02]/CA-2: mensaje explícito exigido por la
                    tarjeta — evita que la administradora crea que el
                    sistema rechazó el archivo por no tener estructura
                    estándar. El backend ya lo conserva tal cual
                    (HU-04/CA-2, lectores/proyectos.py), esto solo lo
                    comunica. */}
                  <p className="carga-de-archivo-nota mt-1 text-xs">
                    El archivo se conservó tal cual fue cargado, aunque su
                    estructura no sea estándar.
                  </p>

                  {/* [HU-04][FE-03], Opción B: lista simple, sin componente
                    nuevo ni agrupación -- los códigos descartados sí la
                    necesitan (categoria), los válidos no aportan nada
                    agrupándolos. */}
                  {resultadoProyectos.codigos.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {resultadoProyectos.codigos.map((codigo) => (
                        <li key={codigo} className="codigo text-xs">
                          {codigo}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* [HU-04][FE-03]: ya construido en PR #79, solo se integra. */}
                  <VistaPreviaDescartes
                    descartes={resultadoProyectos.descartes}
                  />
                </>
              )
            }
            error={errorProyectos}
            onCargar={subirProyectos}
          />

          <div className="flex items-center justify-between border-t border-gray-100 pt-5">
            {yaRegistrado ? (
              <>
                <div className="flex items-center gap-2 rounded-sm border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                  <Check size={13} />
                  Corte registrado
                </div>
                <Link
                  to={`/matriz/${corte.id}`}
                  className="rounded-sm bg-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-hover"
                >
                  Ver matriz de relación
                </Link>
              </>
            ) : (
              <div className="flex flex-1 flex-col gap-2">
                <button
                  type="button"
                  disabled={!todosCargados || registrando}
                  onClick={manejarRegistro}
                  className="self-start rounded-sm bg-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Registrar corte
                </button>
                {!todosCargados && (
                  <p className="text-[11px] italic text-gray-400">
                    Cargue los tres archivos para registrar el corte.
                  </p>
                )}
                {registrando && <Cargando mensaje="Registrando corte…" />}
                <EstadoError error={errorRegistro} />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-5">
        <h1 className="text-base font-semibold text-gray-800">Nuevo corte</h1>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Configure los datos del corte para habilitar la carga de archivos.
        </p>
      </header>

      <form
        onSubmit={manejarEnvio}
        className="rounded-sm border border-gray-200 bg-white p-5"
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Datos del corte
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="vigencia"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
            >
              Vigencia
            </label>
            <input
              id="vigencia"
              name="vigencia"
              type="number"
              // D18 (docs/DECISIONES.md, 2026-09-23): min/max solo es ayuda
              // de UX -- el rechazo real ya lo hace el backend
              // (Corte.validar_vigencia), igual que la fecha de abajo. No se
              // repiten estos numeros como constante compartida porque el
              // backend es Python y el frontend JS; si el rango cambia, hay
              // que actualizar los dos lados (ver D18).
              min={2000}
              max={2100}
              placeholder="Ej: 2026"
              value={vigencia}
              onChange={(evento) => setVigencia(evento.target.value)}
              required
              className="w-full rounded-sm border border-gray-300 bg-fondo-input px-3 py-2 text-sm focus:border-azul focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="fecha-corte"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
            >
              Fecha del corte
            </label>
            <input
              id="fecha-corte"
              name="fechaCorte"
              type="date"
              max={fechaMaxima}
              value={fechaCorte}
              onChange={(evento) => {
                const nuevaFecha = evento.target.value;
                if (nuevaFecha <= fechaMaxima) {
                  setFechaCorte(nuevaFecha);
                }
              }}
              required
              className="w-full rounded-sm border border-gray-300 bg-fondo-input px-3 py-2 font-mono text-sm focus:border-azul focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-sm bg-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
            </button>
          </div>
        </div>

        {enviando && <Cargando mensaje="Creando corte…" />}
        <EstadoError error={error} />
      </form>
    </section>
  );
}
