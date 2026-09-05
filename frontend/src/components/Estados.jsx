/**
 * Estados de interfaz reutilizables: cargando, vacío y error.
 *
 * TARJETA: [UX-04] Estados compartidos de carga, vacío y error
 * USADO POR: [UX-02], [HU-02][FE-02], [HU-03][FE-02], [HU-04][FE-02],
 *            [HU-07][FE-02]
 *
 * Se centralizan para que cada pantalla los trate igual.
 *
 * LO IMPORTANTE ESTÁ EN `Error`: un error del backend puede traer `detalles`
 * (qué columna o pestaña falta). Mostrarlos es la diferencia entre «no se pudo
 * cargar» y un mensaje accionable — que es justamente lo que piden
 * HU-02/CA-3, HU-03/CA-4 y HU-01/CA-3.
 */
/*
export function Cargando({ mensaje = "Cargando…" }) {
  // TODO [UX-04] role="status" aria-live="polite"
  return null;
}

export function Vacio({ titulo, descripcion, accion }) {
  // TODO [UX-04]
  return null;
}

export function Error({ error, onReintentar }) {
  // TODO [UX-03] Traducir error.detalles a una lista legible:
  //   columnas_faltantes -> "Columnas faltantes: ..."
  //   pestanas_faltantes -> "Pestañas faltantes: ..."
  //   archivos_faltantes -> "Archivos faltantes: ..."
  return null;
}
*/
