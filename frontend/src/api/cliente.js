/**
 * Cliente HTTP único de GovSync.
 *
 * TARJETA: [UX-01] Layout base, enrutamiento y cliente HTTP
 *
 * Centraliza tres cosas que no deben repetirse en cada componente: la URL
 * base, las cabeceras y la traducción de los errores del backend a un objeto
 * de error uniforme.
 *
 * El backend responde los errores de negocio con esta forma (ver
 * app/core/errores.py):
 *
 *     { "codigo": "...", "mensaje": "...", "detalles": { ... } }
 *
 * `detalles` es lo que hace accionable un error: trae `columnas_faltantes`,
 * `pestanas_faltantes` o `archivos_faltantes` según el caso. [UX-03] depende
 * de que este cliente NO los descarte.
 */

//#const BASE = import.meta.env.VITE_API_URL ?? "";

export class ErrorApi extends Error {
  constructor(mensaje, { estado, codigo, detalles } = {}) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles ?? {};
  }
}

//async function solicitar(ruta, { metodo = "GET", cuerpo, archivo } = {}) {
// TODO [UX-01] Construir la petición:
//   - archivo -> FormData con el campo "archivo"
//   - cuerpo  -> JSON con Content-Type
//   - respuesta no-ok -> lanzar ErrorApi conservando codigo y detalles
//throw new Error("[UX-01] Cliente HTTP sin implementar");
//}

export const api = {
  // TODO [HU-01][FE-01] crearCorte, listarCortes, obtenerCorte, registrarCorte
  // TODO [HU-02..04][FE-01] cargarArchivo(corteId, tipo, archivo)
  // TODO [HU-07][FE-01] matriz(corteId, pagina, tamanoPagina)
};
