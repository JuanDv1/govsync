/**
 * Ayudas para descargar el Excel del Plan de Acción.
 *
 * TARJETA: [E04-HU03] Exportar el Plan de Acción a Excel (frontend)
 * CRITERIOS: HU03-CA05 (nombre del archivo), HU03-CA08 (mensaje de error)
 *
 * Todo es puro (sin React ni fetch) salvo `guardarArchivo`, que es lo único
 * que toca el DOM. Mismo criterio que `filtros.js` y `formato.js`.
 */

/**
 * Nombre del archivo que manda el servidor en `Content-Disposition`, o `null`
 * si no hay. Acepta `filename*=UTF-8''…` (codificado), `filename="…"` y
 * `filename=…`. Se queda solo con el último tramo de una ruta: el nombre nunca
 * trae carpetas.
 */
export function nombreDeContentDisposition(cabecera) {
  if (!cabecera) return null;

  let nombre = null;
  const codificado = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(cabecera);
  if (codificado) {
    try {
      nombre = decodeURIComponent(codificado[1].trim());
    } catch {
      nombre = null;
    }
  }
  if (nombre === null) {
    const simple =
      /filename\s*=\s*"([^"]*)"/i.exec(cabecera) ??
      /filename\s*=\s*([^;]+)/i.exec(cabecera);
    nombre = simple ? simple[1].trim() : null;
  }

  const ultimoTramo = nombre?.split(/[\\/]/).pop().trim();
  return ultimoTramo || null;
}

/**
 * Nombre del archivo cuando el navegador no deja leer `Content-Disposition`
 * (el CORS del backend no lo expone). Es la regla de D28 y de HU03-CA05, copia
 * de `construir_nombre_archivo` en
 * `backend/app/modules/plan_accion/persistence/exportacion_excel.py`: la fecha
 * es la del CORTE, no la de la descarga. Si cambia allí, cambia aquí.
 */
export function nombreArchivoPlanAccion(vigencia, fechaCorte) {
  return `Plan_Accion_${vigencia}_Corte_${fechaCorte}.xlsx`;
}

/** Lo que se le dice a la persona cuando la exportación falla (HU03-CA08). */
const MENSAJE_GENERICO = "No fue posible generar el archivo, intente de nuevo";

/**
 * Mensaje para un error de `api.exportarPlanAccion`. `error` es un `ErrorApi`
 * (`estado`, `detalles`); cualquier otro fallo —red, 500, una respuesta que no
 * es un Excel— usa el mensaje genérico de HU03-CA08.
 */
export function mensajeErrorExportacion(error) {
  switch (error?.estado) {
    case 401:
      return "Su sesión expiró; vuelva a iniciar sesión.";
    case 403:
      return "Su rol no tiene permiso para exportar el Plan de Acción.";
    case 404:
      return "Aún no hay cortes finalizados para exportar.";
    case 409: {
      const faltantes = error.detalles?.archivos_faltantes;
      return Array.isArray(faltantes) && faltantes.length > 0
        ? `Al corte actual le falta cargar: ${faltantes.join(", ")}.`
        : "Al corte actual le falta cargar alguna de las fuentes.";
    }
    default:
      return MENSAJE_GENERICO;
  }
}

/**
 * Guarda `blob` como un archivo descargado con ese `nombre`: crea una URL
 * temporal, pulsa un enlace oculto y la revoca un poco después (revocarla de
 * inmediato corta la descarga en algunos navegadores). Lo único de este módulo
 * que usa el DOM.
 */
export function guardarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.hidden = true;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
