/**
 * Lógica pura de la comparación de dos cortes del Plan de Acción.
 *
 * TARJETA: [E04-HU04] Comparar dos cortes de una misma vigencia (frontend)
 * CRITERIOS: HU04-CA03 (consulta), HU04-CA05 (sentido del Δ), HU04-CA08
 * (nombre del archivo), errores de las "Reglas de negocio" del spec
 * (docs/specs/E04-HU04-comparar-cortes.md) y D29.
 *
 * Sin React, sin fetch, sin efectos: mismo criterio que `filtros.js`,
 * `filtrosPlanAccion.js` y `formato.js`.
 */

/**
 * Query string de `GET /plan-accion/comparar` y de `/comparar/exportar`:
 * `corte_id_1`, `corte_id_2` y, solo si está activo, `solo_cambios=true` (el
 * backend lo toma como `false` si no viene). El orden de los dos ids no
 * importa: el backend decide cuál es "Corte A" (D29 punto 1).
 */
export function consultaComparacion(corteId1, corteId2, soloCambios = false) {
  const parametros = new URLSearchParams({
    corte_id_1: corteId1,
    corte_id_2: corteId2,
  });
  if (soloCambios) parametros.set("solo_cambios", "true");
  return parametros.toString();
}

/**
 * Sentido de un Δ (HU04-CA05) a partir del valor REAL, no del redondeado:
 * `"sube"` (> 0), `"baja"` (< 0), `"igual"` (0) o `null` si no hay Δ (meta en
 * un solo corte, o sin dato en uno de los dos: no es comparable, que es
 * distinto de "no cambió"). Acepta el texto Decimal del backend.
 */
export function sentidoDelta(valor) {
  if (valor == null) return null;
  const n = Number(valor);
  if (n > 0) return "sube";
  if (n < 0) return "baja";
  return "igual";
}

/**
 * Nombre del Excel de la comparación cuando el navegador no deja leer
 * `Content-Disposition` (HU04-CA08: "el nombre incluye las fechas de ambos
 * cortes"). Copia de la regla de `exportar_comparacion_plan_accion` en
 * `backend/app/modules/plan_accion/api/router.py`; si cambia allí, cambia
 * aquí. `fechaA` es la del corte más antiguo y `fechaB` la del más reciente,
 * tal como las devuelve `/comparar` ("AAAA-MM-DD").
 */
export function nombreArchivoComparacion(vigencia, fechaA, fechaB) {
  return `Comparacion_Plan_Accion_${vigencia}_${fechaA}_vs_${fechaB}.xlsx`;
}

/**
 * Mensaje específico para un error de `/comparar` o de `/comparar/exportar`,
 * o `null` si no hay uno y corresponde el genérico de quien llama. El 409 y el
 * 422 se distinguen por `detalles.motivo` (y `detalles.archivos_faltantes`),
 * no por `codigo`: el `codigo` es el mismo para todos los casos de cada uno
 * (D29 punto 2).
 */
function mensajeSegunEstado(error) {
  const detalles = error?.detalles ?? {};

  switch (error?.estado) {
    case 401:
      return "Su sesión expiró; vuelva a iniciar sesión.";
    case 403:
      return "Su rol no tiene acceso al Plan de Acción.";
    case 404:
      return "Uno de los cortes elegidos ya no existe. Vuelva a elegirlos.";
    case 409: {
      if (detalles.motivo === "corte_no_registrado") {
        return "Uno de los cortes elegidos todavía no está finalizado.";
      }
      const faltantes = detalles.archivos_faltantes;
      if (Array.isArray(faltantes) && faltantes.length > 0) {
        return `A uno de los cortes le falta cargar: ${faltantes.join(", ")}.`;
      }
      return "Uno de los cortes elegidos no se puede comparar en este momento.";
    }
    case 422:
      if (detalles.motivo === "mismo_corte") {
        return "Elija dos cortes distintos.";
      }
      if (detalles.motivo === "vigencias_distintas") {
        return "Los dos cortes deben ser de la misma vigencia.";
      }
      return "La combinación de cortes elegida no es válida.";
    default:
      return null;
  }
}

/** Mensaje para un error al comparar (`/comparar`, `/cortes-disponibles`). */
export function mensajeErrorComparacion(error) {
  return (
    mensajeSegunEstado(error) ??
    "No fue posible comparar los cortes, intente de nuevo."
  );
}

/**
 * Mensaje para un error al exportar la comparación (`/comparar/exportar`).
 * Lo que no tiene mensaje propio usa el de HU03-CA08, igual que el Excel del
 * Plan de Acción.
 */
export function mensajeErrorExportarComparacion(error) {
  return (
    mensajeSegunEstado(error) ??
    "No fue posible generar el archivo, intente de nuevo"
  );
}
