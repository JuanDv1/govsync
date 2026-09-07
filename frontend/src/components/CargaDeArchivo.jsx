/**
 * Control reutilizable de carga de un archivo fuente.
 *
 * TARJETA: [UX-02] Componente reutilizable de carga de archivos
 * USADO POR: [HU-02][FE-02], [HU-03][FE-02], [HU-04][FE-02]
 *
 * Un solo componente para las tres cargas. Debe cubrir:
 *   - selección de archivo (.xlsx), estado "procesando"
 *   - reporte de lo reconocido (HU-02/CA-5: "cuántas metas")
 *   - error específico con sus detalles (usa [UX-03])
 *   - opción de REEMPLAZAR si ya hay uno cargado (HU-01/CA-6 y HU-06)
 *
 * OJO [HU-03][FE-02]: UN solo control para el archivo presupuestal aunque
 * tenga dos pestañas — así lo exige HU-03/CA-2 —, con confirmación que reporta
 * ambas pestañas por separado.
 */
/*
export default function CargaDeArchivo({
  tipo,
  etiqueta,
  cargado,
  resultado,
  error,
  onCargar,
}) {
  // TODO [UX-02]
  return null;
}
*/
