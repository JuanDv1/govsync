/**
 * Estados de interfaz reutilizables: cargando, vacío y error.
 *
 * TARJETA: [UX-04] Estados compartidos de carga, vacío y error
 * USADO POR: [UX-02], [HU-02][FE-02], [HU-03][FE-02], [HU-04][FE-02],
 *            [HU-07][FE-02]
 *
 * Se centralizan para que cada pantalla los trate igual.
 *
 * LO IMPORTANTE ESTÁ EN `EstadoError`: un error del backend puede traer `detalles`
 * (qué columna o pestaña falta). Mostrarlos es la diferencia entre «no se pudo
 * cargar» y un mensaje accionable — que es justamente lo que piden
 * HU-02/CA-3, HU-03/CA-4 y HU-01/CA-3.
 */

import { CircleAlert, Inbox, LoaderCircle, RotateCw } from "lucide-react";

import Boton from "./shared/Boton.jsx";

//: Cargando: icono que gira (solo si la persona acepta animaciones) y una
//: frase. `aria-busy` avisa a los lectores de pantalla de que la región se
//: está actualizando. Sin caja: sirve igual solo en la pantalla que dentro de
//: un panel.
export function Cargando({ mensaje = "Cargando…" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex items-center justify-center gap-3 px-6 py-10 text-cuerpo text-gray-700"
    >
      <LoaderCircle
        size={24}
        aria-hidden="true"
        className="shrink-0 text-azul-accion motion-safe:animate-spin"
      />
      <p>{mensaje}</p>
    </div>
  );
}

//: Vacío: icono (`icono`, por defecto una bandeja), qué pasa y, si hay algo
//: que hacer, la acción. Las props de siempre; `icono` es nuevo y opcional.
//: Estilos en Tailwind (D19): antes usaba cuatro clases `estado-vacio*` que
//: nunca tuvieron CSS, así que se veía como texto suelto.
export function Vacio({ titulo, descripcion, accion, icono: Icono = Inbox }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-tarjeta border border-gray-200 bg-white px-6 py-10 text-center shadow-suave">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tinte-azul text-azul-accion">
        <Icono size={28} aria-hidden="true" />
      </span>
      {titulo && (
        <p className="text-tarjeta font-semibold text-gray-800">{titulo}</p>
      )}
      {descripcion && (
        <p className="max-w-md text-cuerpo text-gray-600">{descripcion}</p>
      )}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

export function SinCorrespondencia({ texto = "Sin correspondencia" }) {
  return <span className="estado-sin-correspondencia">{texto}</span>;
}

// [UX-03] Se llama `EstadoError` (no `Error`) para no ocultar el `Error`
// nativo de JS en los archivos que lo importan.

//: Claves de `detalles` documentadas hoy (ver comentario de api/cliente.js).
// Cualquier clave nueva que el backend agregue se muestra igual, con una
// etiqueta genérica — nunca se descarta en silencio.
const ETIQUETAS_DETALLE_CONOCIDAS = {
  columnas_faltantes: "Columnas faltantes",
  pestanas_faltantes: "Pestañas faltantes",
  archivos_faltantes: "Archivos faltantes",
};

function etiquetaGenerica(clave) {
  const texto = clave.replaceAll("_", " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function listarDetalles(detalles) {
  return Object.entries(detalles)
    .filter(([, valor]) =>
      Array.isArray(valor) ? valor.length > 0 : Boolean(valor),
    )
    .map(([clave, valor]) => {
      const etiqueta =
        ETIQUETAS_DETALLE_CONOCIDAS[clave] ?? etiquetaGenerica(clave);
      const texto = Array.isArray(valor) ? valor.join(", ") : String(valor);
      return { clave, texto: `${etiqueta}: ${texto}` };
    });
}

//: Qué puede hacer la persona ante este error. Un texto genérico para lo
//: que no se sabe, y uno específico para los casos que se reconocen.
function sugerenciaPara(error, detalles) {
  const tieneFaltantes = [
    "archivos_faltantes",
    "columnas_faltantes",
    "pestanas_faltantes",
  ].some((clave) => (detalles[clave] ?? []).length > 0);

  if (tieneFaltantes) {
    return "Cargue o corrija lo que falta y vuelva a intentarlo.";
  }
  if (error.estado === 401) return "Vuelva a iniciar sesión.";
  if (error.estado === 403) {
    return "Pida acceso al administrador del sistema.";
  }
  return "Intente de nuevo. Si el problema continúa, avise al administrador.";
}

//: Error: dice qué pasó, los detalles que haya y qué hacer. `role="alert"`
//: lo anuncia al aparecer. `accionSugerida` reemplaza el texto de "Qué puede
//: hacer" cuando quien llama sabe algo más específico.
export function EstadoError({ error, onReintentar, accionSugerida }) {
  if (!error) return null;

  const mensaje = error.message || "Ocurrió un error inesperado.";
  const detalles = error.detalles ?? {};
  const items = listarDetalles(detalles);

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-tarjeta border-[1.5px] border-red-700 bg-red-50 p-5"
    >
      <CircleAlert
        size={24}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-red-700"
      />
      <div className="min-w-0 flex-1">
        <p className="text-cuerpo font-semibold text-red-800">{mensaje}</p>

        {items.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-cuerpo text-gray-800">
            {items.map(({ clave, texto }) => (
              <li key={clave}>{texto}</li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-cuerpo text-gray-800">
          <span className="font-semibold">Qué puede hacer:</span>{" "}
          {accionSugerida ?? sugerenciaPara(error, detalles)}
        </p>

        {error.codigo && (
          <p className="mt-2 text-ayuda text-gray-600">
            Código del error: <span className="codigo">{error.codigo}</span>
          </p>
        )}

        {onReintentar && (
          <div className="mt-4">
            <Boton
              variante="secundario"
              icono={RotateCw}
              onClick={onReintentar}
            >
              Reintentar
            </Boton>
          </div>
        )}
      </div>
    </div>
  );
}
