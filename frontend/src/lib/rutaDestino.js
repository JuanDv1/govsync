/**
 * Ruta a la que se vuelve tras iniciar sesión ([E-01/HU-01] CA07).
 *
 * `RutaProtegida` guarda la ruta que la persona intentó abrir y `Login.jsx`
 * se la pasa a Keycloak como `redirectUri`. Ese valor viaja por el estado de
 * navegación, que cualquiera puede manipular, así que solo se acepta una
 * ruta interna: empieza con una sola "/" y no es la propia pantalla de login
 * (volver a ella dejaría a la persona autenticada en el login). Cualquier
 * otra cosa cae al destino por defecto.
 *
 * Defensa en profundidad: el `redirectUri` ya se arma como
 * `window.location.origin + ruta`, así que el host nunca cambia; esto solo
 * descarta valores raros antes de llegar a Keycloak.
 */
export const RUTA_POR_DEFECTO = "/cortes";

export function rutaDestinoSegura(desde) {
  if (typeof desde !== "string") return RUTA_POR_DEFECTO;
  if (!desde.startsWith("/") || desde.startsWith("//")) return RUTA_POR_DEFECTO;
  if (desde.includes("\\")) return RUTA_POR_DEFECTO;
  // "/login", "/login/", "/login?x", "/login#x" y "/login/…", pero no
  // "/loginx" (otra ruta que solo empieza igual).
  if (/^\/login(?:[/?#]|$)/.test(desde)) return RUTA_POR_DEFECTO;
  return desde;
}
