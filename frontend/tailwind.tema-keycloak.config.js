/**
 * Tailwind del tema de login de Keycloak ([E-01/HU-01], decisión del PO del
 * 2026-11-16): los MISMOS tokens que la aplicación (`tailwind.config.js`), pero
 * escaneando las plantillas `.ftl` del tema en vez del código React.
 *
 * Genera `keycloak/themes/govsync/login/resources/css/govsync.css` con
 * `npm run build:tema-keycloak` (ver README). El CSS generado se versiona: el
 * contenedor de Keycloak no ejecuta Node.
 */
import base from "./tailwind.config.js";

export default {
  ...base,
  content: ["../keycloak/themes/govsync/login/**/*.ftl"],
};
