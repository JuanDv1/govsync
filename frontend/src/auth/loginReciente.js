/**
 * Marca de "se acaba de iniciar sesión desde esta pestaña" ([E-01/HU-01] CA07).
 *
 * Tras volver de Keycloak, la app necesita saber que la persona viene de
 * iniciar sesión (y no que escribió una URL con la sesión ya abierta) para
 * decidir si la ruta que pidió antes del login le corresponde o debe ir a su
 * vista inicial. El rol solo se conoce después del login, así que el aviso
 * cruza la redirección por `sessionStorage` (propio de la pestaña).
 *
 * No guarda datos de la persona, solo "1". Sin `sessionStorage` disponible la
 * marca no existe: se pierde la redirección por rol (se ve el aviso de "no
 * tiene permiso" del módulo), no la seguridad.
 */
const CLAVE = "govsync.loginReciente";

export function marcarLoginReciente() {
  try {
    window.sessionStorage.setItem(CLAVE, "1");
  } catch {
    // Sin almacenamiento: no hay marca.
  }
}

/** Lee y borra la marca: solo vale para la primera carga tras el login. */
export function consumirLoginReciente() {
  try {
    const hay = window.sessionStorage.getItem(CLAVE) === "1";
    window.sessionStorage.removeItem(CLAVE);
    return hay;
  } catch {
    return false;
  }
}
