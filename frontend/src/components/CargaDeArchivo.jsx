/**
 * Control reutilizable de carga de un archivo fuente.
 *
 * TARJETA: [UX-02] Componente reutilizable de carga de archivos
 * USADO POR: [HU-02][FE-02], [HU-03][FE-02], [HU-04][FE-02]
 *
 * Un solo componente para las tres cargas. Debe cubrir:
 *   - selección de archivo (.xlsx) por clic o arrastrar-soltar, estado "procesando"
 *   - reporte de lo reconocido (HU-02/CA-5: "cuántas metas")
 *   - error específico con sus detalles (usa [UX-03])
 *   - opción de REEMPLAZAR si ya hay uno cargado (HU-01/CA-6 y HU-06)
 *
 * OJO [HU-03][FE-02]: UN solo control para el archivo presupuestal aunque
 * tenga dos pestañas — así lo exige HU-03/CA-2 —, con confirmación que reporta
 * ambas pestañas por separado.
 *
 * DISEÑO: `onCargar` llega como prop, este componente NUNCA llama a
 * `api.cargarArchivo()` directamente — esa función sigue bloqueada
 * ([HU-02..04][BE-04/BE-06], el endpoint no existe todavía). Así el
 * componente sirve por igual a las tres rutas de subida (PDT, EJECUCION,
 * PROYECTOS) sin conocer a cuál apunta cada una; el padre decide.
 *
 * `onCargar` firma completa:
 *   onCargar(archivo: File, actualizarProgreso: (porcentaje: number) => void)
 * `actualizarProgreso` es opcional de usar por quien implemente `onCargar`
 * — si nunca se invoca, el componente simplemente no muestra la barra de
 * progreso y se queda con el spinner indeterminado de `Cargando`. Hoy
 * `cliente.js` no tiene ninguna implementación con progreso real (usa
 * `fetch()`, sin `onprogress`) — requeriría una función aislada con
 * `XMLHttpRequest`, propuesta pero no implementada aquí (coordinar con
 * quien mantiene `cliente.js`, [UX-01]).
 *
 * `resultado` llega ya formateado por el padre (ReactNode). Este componente
 * no interpreta campos como `metas_reconocidas` o `filas_ejecucion_reconocidas`
 * — esos varían por tipo y son responsabilidad de cada pantalla `[HU-0x][FE-02]`.
 *
 * `error` sigue la forma de `ErrorApi` (`.message`, `.codigo`, `.detalles`) y
 * se delega tal cual a `Estados.jsx::Error` — [SEC-03] vive en el backend
 * (docs/SEGURIDAD.md), este componente no reimplementa esas reglas; el
 * `accept=".xlsx"` y `TAMANO_MAXIMO_BYTES` de abajo son solo ayuda de UX,
 * no una validación real.
 */

import { useId, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet } from "lucide-react";
import { Cargando, Error as EstadoError } from "./Estados.jsx";

const TAMANO_MAXIMO_BYTES = 2_097_152; // 2 MB — acordado con Cristhian,
// archivos reales hoy < 200 KB (ver docs/DECISIONES.md D12)

function tieneExtensionValida(nombreArchivo) {
  return nombreArchivo.toLowerCase().endsWith(".xlsx");
}

export default function CargaDeArchivo({
  tipo,
  etiqueta,
  cargado,
  resultado,
  error,
  onCargar,
}) {
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [avisoExtension, setAvisoExtension] = useState(false);
  const [avisoTamano, setAvisoTamano] = useState(false);
  // Solo para mostrar el nombre del último archivo aceptado (UX-02); no
  // participa en la validación ni en `onCargar`.
  const [nombreArchivo, setNombreArchivo] = useState(null);
  // Solo visual: resalta la zona al arrastrar un archivo encima.
  const [arrastrando, setArrastrando] = useState(false);
  const idEntrada = useId();

  async function procesarArchivo(archivo) {
    if (!archivo) return;

    if (!tieneExtensionValida(archivo.name)) {
      setAvisoExtension(true);
      setAvisoTamano(false);
      return;
    }

    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setAvisoTamano(true);
      setAvisoExtension(false);
      return;
    }

    setAvisoExtension(false);
    setAvisoTamano(false);
    setProgreso(null);
    setEnviando(true);
    setNombreArchivo(archivo.name);
    try {
      await onCargar(archivo, (porcentaje) => setProgreso(porcentaje));
    } finally {
      setEnviando(false);
    }
  }

  async function manejarSeleccion(evento) {
    const archivo = evento.target.files?.[0];
    // Permite volver a seleccionar el mismo archivo después de un error o
    // aviso, ya que un input de archivo no dispara "change" dos veces con
    // el mismo valor si no se limpia.
    evento.target.value = "";
    await procesarArchivo(archivo);
  }

  function manejarArrastrarSobre(evento) {
    // Requerido por la especificación HTML para que "drop" dispare.
    evento.preventDefault();
    setArrastrando(true);
  }

  function manejarSalirArrastre() {
    setArrastrando(false);
  }

  async function manejarSoltar(evento) {
    evento.preventDefault();
    setArrastrando(false);
    const archivo = evento.dataTransfer.files?.[0];
    await procesarArchivo(archivo);
  }

  if (enviando) {
    return (
      <div
        className="rounded-sm border border-gray-200 bg-white p-5"
        data-tipo={tipo}
      >
        <Cargando mensaje={`Subiendo ${etiqueta}…`} />
        {progreso !== null && (
          <p className="carga-de-archivo-progreso mt-2 flex items-center gap-2 text-xs text-gray-500">
            <progress value={progreso} max={100} className="w-full" />
            <span className="font-mono">{progreso}%</span>
          </p>
        )}
      </div>
    );
  }

  const etiquetaAccion = cargado ? "Reemplazar" : "Cargar";

  return (
    <div
      className="rounded-sm border border-gray-200 bg-white p-5"
      data-tipo={tipo}
    >
      <p className="mb-1 text-sm font-semibold text-gray-800">{etiqueta}</p>

      {!cargado && (
        <label
          htmlFor={idEntrada}
          onDragOver={manejarArrastrarSobre}
          onDragLeave={manejarSalirArrastre}
          onDrop={manejarSoltar}
          className={`mt-3 block cursor-pointer rounded-sm border-2 border-dashed p-10 text-center transition-colors ${
            arrastrando
              ? "border-azul bg-blue-50/60"
              : "border-gray-300 bg-fondo-input hover:border-gray-400"
          }`}
        >
          <FileSpreadsheet size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">
            Arrastre el archivo aquí o haga clic
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Formato: .xlsx · Máximo {TAMANO_MAXIMO_BYTES / 1_048_576} MB
          </p>
          <span className="mt-4 inline-block rounded-sm border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-azul">
            Seleccionar archivo
          </span>
        </label>
      )}

      {cargado && !error && (
        <div className="mt-3 flex items-center gap-3 rounded-sm border border-green-200 bg-green-50 p-3">
          <Check size={15} className="shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-green-800">
              Archivo cargado correctamente
            </p>
            {nombreArchivo && (
              <p className="mt-0.5 font-mono text-[11px] text-green-600">
                {nombreArchivo}
              </p>
            )}
          </div>
          <label
            htmlFor={idEntrada}
            className="cursor-pointer text-[11px] font-medium text-green-600 hover:text-green-800"
          >
            Reemplazar
          </label>
        </div>
      )}

      {/* Si ya había un archivo cargado y el último intento de reemplazo
          falló, el banner verde de arriba no se muestra (hay `error`) — este
          enlace es la única forma de volver a intentarlo, ya que la zona de
          arrastrar-soltar tampoco se muestra mientras `cargado` es true. */}
      {cargado && error && (
        <label
          htmlFor={idEntrada}
          className="mt-3 inline-block cursor-pointer text-[11px] font-medium text-azul hover:text-navy"
        >
          Seleccionar otro archivo
        </label>
      )}

      <input
        id={idEntrada}
        type="file"
        accept=".xlsx"
        onChange={manejarSeleccion}
        className="sr-only"
        aria-label={`${etiquetaAccion} ${etiqueta}`}
      />

      {avisoExtension && (
        <div className="mt-3 flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-800">
            Solo se aceptan archivos .xlsx.
          </p>
        </div>
      )}

      {avisoTamano && (
        <div className="mt-3 flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-800">
            El archivo supera el tamaño máximo permitido (
            {TAMANO_MAXIMO_BYTES / 1_048_576} MB).
          </p>
        </div>
      )}

      {error && <EstadoError error={error} />}

      {!error && resultado && (
        <div className="carga-de-archivo-resultado mt-3">{resultado}</div>
      )}
    </div>
  );
}
