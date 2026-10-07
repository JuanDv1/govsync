/**
 * Edición de archivos del corte actual (ya Registrado).
 *
 * TARJETA: [E02-HU05] Modificar archivos del corte actual
 * ESPECIFICACIÓN: docs/specs/E02-HU05-modificar-archivos-corte-actual.md
 *
 * ESTADO DEL BACKEND (importante para quien revise esta pantalla): el
 * contrato que consume esta página (`api.reemplazarArchivoCorteActual`,
 * `api.historialCorte`, el campo `es_corte_actual` en la respuesta de
 * `GET /cortes/{id}`, y `nombre_archivo`/`fecha_carga` en cada fuente) es
 * **PROPUESTA** — no existe todavía en el backend (ver la spec, sección
 * Contrato). Esta pantalla ya está construida contra ese contrato para que
 * el backend tenga un consumidor real al implementarlo; hasta entonces:
 *   - `GET /cortes/{id}` no envía `es_corte_actual` → el bloqueo de CA-5
 *     ("Solo se puede editar el corte más reciente") usa el fallback de
 *     `lib/corteActual.js` (mismo criterio que `Cortes.jsx`): se trae la
 *     lista completa (`GET /cortes`) solo para resolver esta pregunta, y se
 *     compara el `id` de este corte contra el primer `REGISTRADO` de esa
 *     lista. Si esa segunda petición falla, se asume que NO es el actual
 *     (falla cerrado) en vez de mostrar un segundo error.
 *   - Reemplazar un archivo y consultar el historial fallan con el error
 *     genérico de la API (404 de ruta inexistente) — se muestran con
 *     `EstadoError` como cualquier otro error, sin tratamiento especial.
 *
 * QUÉ CUBRE ESTA PANTALLA (ver la spec para el detalle de cada CA):
 *   CA-1  metadatos de cada fuente (nombre de archivo, fecha de carga). El
 *         Excel también pide "usuario que cargó" aquí, pero a pedido del
 *         producto esta pantalla no lo muestra — depende de E-01 (sin
 *         implementar, [VALIDAR] en la spec) y no se consideró necesario
 *         exponerlo en este bloque. CA-6 sí sigue mostrando el usuario, en
 *         el historial de auditoría más abajo.
 *   CA-2  reemplazo de una fuente con las mismas reglas de carga que
 *         HU-02/03/04 (reutiliza `CargaDeArchivo`, igual que NuevoCorte.jsx).
 *         "Actualiza el Plan de Acción" es `[VALIDAR]` en la spec (ese
 *         módulo no existe) — no se implementa aquí. "Recalcula el cruce"
 *         tampoco dispara nada propio aquí: es otro `[VALIDAR]` de la spec
 *         (podría ocurrir solo por cómo se calcula la matriz en HU-07, pero
 *         el equipo no lo ha confirmado) — esta pantalla no asume ninguna
 *         de las dos posibilidades.
 *   CA-3  confirmación antes de reemplazar (`ModalConfirmacion`). La spec
 *         deja `[VALIDAR]` si "validar sin aplicar" debería existir como
 *         paso separado (Opción A) o si confirmar-y-revertir (Opción B)
 *         basta — el equipo no ha elegido. Esta pantalla ya tuvo que
 *         construirse sobre una de las dos para tener algo que mostrar:
 *         asume la Opción B (confirmar primero, `reemplazar` revierte sin
 *         tocar el estado si la API rechaza el archivo). Si el equipo
 *         decide la Opción A, esta pantalla necesita un paso de validación
 *         previo antes de pedir la confirmación — cambio pendiente, no
 *         implementado.
 *   CA-4  archivo inválido: lo maneja `CargaDeArchivo`/`EstadoError`, mismo
 *         patrón que las demás cargas.
 *   CA-5  cortes que no son el actual: bloqueo explícito, sin acción de
 *         edición.
 *   CA-6  historial de auditoría (sección separada, con su propio estado de
 *         carga/error para no bloquear el resto de la pantalla si falla).
 *   CA-7  (avance físico) y CA-9 (restricción por rol): NO tienen
 *         contraparte en esta pantalla — son `[VALIDAR]`/dependientes de
 *         E-01 en la spec, sin backend que implementar todavía.
 *   CA-8  si el reemplazo falla, no se optimiza nada en el cliente: el
 *         estado local solo cambia en el `.then` de éxito, así que un error
 *         deja la pantalla exactamente como estaba (mismo efecto que el
 *         rollback del backend, visto desde el frontend).
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/cliente.js";
import CargaDeArchivo from "../components/CargaDeArchivo.jsx";
import { Cargando, EstadoError, Vacio } from "../components/Estados.jsx";
import Card from "../components/shared/Card.jsx";
import ModalConfirmacion from "../components/shared/ModalConfirmacion.jsx";
import SectionHeader from "../components/shared/SectionHeader.jsx";
import { esCorteActual } from "../lib/corteActual.js";
import { fechaHora } from "../lib/formato.js";

const FUENTES = [
  { tipo: "PDT", etiqueta: "Plan Indicativo" },
  { tipo: "EJECUCION", etiqueta: "Ejecución presupuestal" },
  { tipo: "PROYECTOS", etiqueta: "Plantilla de proyectos BPIN" },
];

// El historial (CA-6) viaja con el código crudo (`tipo`); se traduce a la
// misma etiqueta que ya usan las tarjetas de arriba, con el código como
// respaldo si el backend llegara a mandar un tipo que esta pantalla no
// conoce todavía.
function etiquetaPorTipo(tipo) {
  return FUENTES.find((fuente) => fuente.tipo === tipo)?.etiqueta ?? tipo;
}

export default function EditarArchivosCorteActual() {
  const { corteId } = useParams();

  const [intentoCorte, setIntentoCorte] = useState(0);
  const [claveCorteCargado, setClaveCorteCargado] = useState(null);
  const [corte, setCorte] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);

  const [resultados, setResultados] = useState({});
  const [errores, setErrores] = useState({});
  const [confirmacion, setConfirmacion] = useState(null);

  const [intentoHistorial, setIntentoHistorial] = useState(0);
  const [claveHistorialCargado, setClaveHistorialCargado] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [errorHistorial, setErrorHistorial] = useState(null);

  // Solo para resolver `esCorteActual()` mientras `GET /cortes/{id}` no
  // envíe `es_corte_actual` (ver docstring del módulo). Sin reintento ni
  // estado de error propio a propósito: si esta petición falla,
  // `esCorteActual()` no encuentra coincidencia y CA-5 bloquea la edición
  // — falla cerrado, igual que si el corte de verdad no fuera el actual.
  const [listaCortes, setListaCortes] = useState(null);
  const [listaCargada, setListaCargada] = useState(false);

  // Mismo patrón que Cortes.jsx/NuevoCorte.jsx: `vigente` evita pisar el
  // estado si el efecto vuelve a correr (cambio de corteId o reintento)
  // antes de que la petición anterior resuelva.
  useEffect(() => {
    const clave = `${corteId}:${intentoCorte}`;
    let vigente = true;

    api
      .obtenerCorte(corteId)
      .then((datos) => {
        if (vigente) {
          setCorte(datos);
          setErrorCarga(null);
          setClaveCorteCargado(clave);
        }
      })
      .catch((errorApi) => {
        if (vigente) {
          setErrorCarga(errorApi);
          setClaveCorteCargado(clave);
        }
      });

    return () => {
      vigente = false;
    };
  }, [corteId, intentoCorte]);

  useEffect(() => {
    const clave = `${corteId}:${intentoHistorial}`;
    let vigente = true;

    api
      .historialCorte(corteId)
      .then((datos) => {
        if (vigente) {
          setHistorial(datos);
          setErrorHistorial(null);
          setClaveHistorialCargado(clave);
        }
      })
      .catch((errorApi) => {
        if (vigente) {
          setErrorHistorial(errorApi);
          setClaveHistorialCargado(clave);
        }
      });

    return () => {
      vigente = false;
    };
  }, [corteId, intentoHistorial]);

  useEffect(() => {
    let vigente = true;

    api
      .listarCortes()
      .then((datos) => {
        if (vigente) setListaCortes(datos);
      })
      .catch(() => {
        // Intencional: ver el comentario de `listaCortes` arriba.
      })
      .finally(() => {
        if (vigente) setListaCargada(true);
      });

    return () => {
      vigente = false;
    };
  }, []);

  const claveActualCorte = `${corteId}:${intentoCorte}`;
  const cargandoCorte = claveCorteCargado !== claveActualCorte;
  const claveActualHistorial = `${corteId}:${intentoHistorial}`;
  const cargandoHistorial = claveHistorialCargado !== claveActualHistorial;

  function archivoPorTipo(tipo) {
    return corte?.archivos?.find((archivo) => archivo.tipo === tipo);
  }

  // Nombre del archivo vigente de `tipo`: el de un reemplazo ya hecho en
  // esta sesión si lo hay, si no el que trajo `GET /cortes/{id}`. Se usa
  // tanto para mostrarlo (CA-1) como para el mensaje de confirmación
  // (CA-3) — así, si la administradora reemplaza la misma fuente dos veces
  // en la misma sesión, el segundo mensaje dice correctamente cuál es el
  // archivo que se va a reemplazar AHORA, no el que había al cargar la
  // página.
  function nombreArchivoVigente(tipo) {
    return (
      resultados[tipo]?.nombre_archivo ?? archivoPorTipo(tipo)?.nombre_archivo
    );
  }

  function solicitarConfirmacion(mensaje) {
    return new Promise((resolver) => {
      setConfirmacion({ mensaje, resolver });
    });
  }

  function responderConfirmacion(confirmado) {
    confirmacion?.resolver(confirmado);
    setConfirmacion(null);
  }

  // CA-3, vía `confirmarAntes` de `CargaDeArchivo`: se pide ANTES de que
  // ese componente muestre "Subiendo…" o toque cualquier otro estado. Si
  // la administradora cancela, esto resuelve `false` y `CargaDeArchivo`
  // nunca llama a `aplicarReemplazo` — "nada cambia", tal como exige el
  // criterio (antes la confirmación vivía dentro del propio reemplazo y el
  // banner "Subiendo…" llegaba a aparecer un instante antes de preguntar).
  function confirmarReemplazo(tipo, archivo) {
    const archivoAnterior = nombreArchivoVigente(tipo) ?? "ningún archivo";
    return solicitarConfirmacion(
      `Se reemplazará ${archivoAnterior} por ${archivo.name} y se recalculará ` +
        `la matriz del corte ${corte.fecha_corte}. ¿Desea continuar?`,
    );
  }

  async function aplicarReemplazo(tipo, archivo) {
    setErrores((anteriores) => ({ ...anteriores, [tipo]: null }));
    try {
      const resultado = await api.reemplazarArchivoCorteActual(
        corte.id,
        tipo,
        archivo,
      );
      setResultados((anteriores) => ({ ...anteriores, [tipo]: resultado }));
      // CA-6: el reemplazo que acaba de aplicarse debe aparecer en el
      // historial sin recargar la página — se refresca la misma consulta
      // que ya tiene su propio loading/error más abajo.
      setIntentoHistorial((n) => n + 1);
    } catch (errorApi) {
      // CA-8: no se tocó `resultados` ni `corte` — la pantalla queda igual
      // que antes del intento, mismo efecto visible que el rollback. Por
      // eso tampoco se refresca el historial aquí: nada cambió de verdad.
      setErrores((anteriores) => ({ ...anteriores, [tipo]: errorApi }));
    }
  }

  if (cargandoCorte || !listaCargada) {
    return (
      <section className="mx-auto max-w-4xl">
        <Cargando mensaje="Cargando corte…" />
      </section>
    );
  }

  if (errorCarga) {
    return (
      <section className="mx-auto max-w-4xl">
        <EstadoError
          error={errorCarga}
          onReintentar={() => setIntentoCorte((n) => n + 1)}
        />
      </section>
    );
  }

  // CA-5, mitad "corte en Borrador": ese corte se corrige con el flujo de
  // creación (E02-HU06), no con esta pantalla.
  if (corte.estado !== "REGISTRADO") {
    return (
      <section className="mx-auto max-w-4xl">
        <Vacio
          titulo="Este corte todavía no está registrado"
          descripcion='Sigue en estado "En creación" — use el flujo de creación para cargar o corregir sus archivos.'
          accion={
            <Link
              to={`/cortes/${corte.id}`}
              className="text-xs font-medium text-azul hover:text-navy"
            >
              Ir al flujo de creación
            </Link>
          }
        />
      </section>
    );
  }

  // CA-5, mitad "no es el más reciente": sin acción de edición, con la
  // misma redacción que pide el criterio de aceptación.
  if (!esCorteActual(corte, listaCortes)) {
    return (
      <section className="mx-auto max-w-4xl">
        <Vacio
          titulo="Solo se puede editar el corte más reciente"
          descripcion="Este corte ya está registrado, pero no es el corte actual."
          accion={
            <Link
              to={`/matriz/${corte.id}`}
              className="text-xs font-medium text-azul hover:text-navy"
            >
              Ver su matriz de relación
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl">
      <Link
        to="/cortes"
        className="text-[11px] font-medium text-azul hover:text-navy"
      >
        ← Volver al histórico
      </Link>

      <header className="mt-2 mb-5">
        <h1 className="text-base font-semibold text-gray-800">
          Editar archivos del corte actual
        </h1>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Corte de vigencia {corte.vigencia}, fecha{" "}
          <span className="font-mono">{corte.fecha_corte}</span>. Reemplazar una
          fuente actualiza la matriz del corte.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {FUENTES.map(({ tipo, etiqueta }) => {
          const archivoActual = archivoPorTipo(tipo);
          const resultado = resultados[tipo];
          const nombreMostrado = nombreArchivoVigente(tipo) ?? null;
          const fechaMostrada = fechaHora(
            resultado?.fecha_carga ?? archivoActual?.fecha_carga,
          );

          return (
            <div key={tipo} className="flex flex-col gap-2">
              <Card padding="px-5 py-3">
                {/* CA-1 pide también "usuario que cargó" aquí — se omite a
                    pedido del producto (decisión registrada en el docstring
                    del módulo, bloque "QUÉ CUBRE ESTA PANTALLA", CA-1).
                    CA-6 sí sigue mostrando el usuario, en el historial de
                    abajo. */}
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Archivo
                    </dt>
                    <dd className="mt-0.5 font-mono text-gray-700">
                      {nombreMostrado ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Cargado
                    </dt>
                    <dd className="mt-0.5 font-mono text-gray-700">
                      {fechaMostrada ?? "—"}
                    </dd>
                  </div>
                </dl>
              </Card>

              <CargaDeArchivo
                tipo={tipo}
                etiqueta={etiqueta}
                cargado
                resultado={
                  resultado && (
                    <p className="text-xs text-gray-600">
                      Archivo reemplazado y cruce recalculado.{" "}
                      {resultado.filas_reconocidas ?? 0} filas reconocidas.
                    </p>
                  )
                }
                error={errores[tipo]}
                confirmarAntes={(archivo) => confirmarReemplazo(tipo, archivo)}
                onCargar={(archivo) => aplicarReemplazo(tipo, archivo)}
              />
            </div>
          );
        })}
      </div>

      <Card className="mt-5">
        <SectionHeader>Historial de reemplazos</SectionHeader>

        {cargandoHistorial && <Cargando mensaje="Cargando historial…" />}

        {!cargandoHistorial && errorHistorial && (
          <EstadoError
            error={errorHistorial}
            onReintentar={() => setIntentoHistorial((n) => n + 1)}
          />
        )}

        {!cargandoHistorial &&
          !errorHistorial &&
          (!historial || historial.length === 0) && (
            <p className="text-xs text-gray-400">
              Ningún archivo se ha reemplazado todavía en este corte.
            </p>
          )}

        {!cargandoHistorial && !errorHistorial && historial?.length > 0 && (
          <ul className="flex flex-col gap-2">
            {historial.map((entrada, indice) => (
              <li
                key={`${entrada.tipo}-${entrada.fecha_hora}-${indice}`}
                className="flex items-center justify-between border-b border-gray-100 pb-2 text-xs last:border-0 last:pb-0"
              >
                <span className="font-medium text-gray-700">
                  {etiquetaPorTipo(entrada.tipo)}
                </span>
                <span className="font-mono text-gray-500">
                  {entrada.nombre_archivo_anterior}
                </span>
                <span className="text-gray-400">
                  {entrada.usuario ?? "—"} ·{" "}
                  {fechaHora(entrada.fecha_hora) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirmacion && (
        <ModalConfirmacion
          titulo="Confirmar reemplazo"
          mensaje={confirmacion.mensaje}
          textoConfirmar="Reemplazar"
          onConfirmar={() => responderConfirmacion(true)}
          onCancelar={() => responderConfirmacion(false)}
        />
      )}
    </section>
  );
}
