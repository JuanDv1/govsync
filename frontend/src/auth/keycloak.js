/**
 * Instancia única de Keycloak ([HU-E01-01], docs/DECISIONES.md D23/D24).
 *
 * Un solo `Keycloak(...)` para toda la app — crear más de una instancia
 * duplicaría el estado de sesión (token, roles) sin ningún beneficio.
 * `ProveedorAutenticacion.jsx` es el único lugar que la inicializa
 * (`keycloak.init()`); este módulo solo la construye.
 */
import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

export default keycloak;
