/**
 * Asistente de creación de un corte.
 *
 * TARJETAS: [HU-01][FE-02] Formulario con calendario restringido
 *           [HU-01][FE-03] Panel de fuentes obligatorias y reutilizadas
 *           [HU-02][FE-02] Pantalla de carga del PDT
 *           [HU-03][FE-02] Pantalla de carga presupuestal
 *           [HU-04][FE-02] Carga de la plantilla BPIN
 *           [HU-04][FE-03] Vista previa de códigos extraídos y descartados
 *
 * FLUJO
 *   Paso 1  vigencia y fecha — el calendario NO permite fechas futuras (CA-2),
 *           pero el rechazo también debe venir del backend: ocultar la opción
 *           en el frontend no es una validación.
 *   Paso 2  carga de los tres archivos. El PDT y la plantilla del municipio
 *           aparecen ya cargados si hay un corte anterior (CA-5), con opción de
 *           reemplazarlos (CA-6). El de ejecución siempre se pide (CA-7).
 *   Paso 3  registrar. El botón solo procede con los tres archivos; si falta
 *           alguno se indica CUÁL (CA-3).
 */
export default function NuevoCorte() {
  return null; // TODO
}
