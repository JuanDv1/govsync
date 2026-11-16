/**
 * Reglas de rol del frontend, en un solo lugar y sin React.
 *
 * TARJETAS: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
 * y FE - Completar inicio de sesión (CA01, CA05, CA07).
 * DECISIONES: D24, D26 y D37 (docs/DECISIONES.md).
 *
 * Todo esto solo decide qué se MUESTRA. La autorización real está en el
 * backend: `LecturaDep` (administrador o visitante), `EscrituraDep` de
 * `cortes` (administrador) y `AccesoPlanAccionDep` (administrador o
 * visitante). Si allá cambia una lista, cambia aquí.
 *
 * `realmAccess.roles` de Keycloak trae además roles propios del realm
 * (`default-roles-*`, `offline_access`, `uma_authorization`) que toda cuenta
 * tiene; por eso las reglas comparan contra listas de roles de GovSync y no
 * contra `roles.length`.
 */

//: D24 + D37: solo `administrador` escribe. Desde el 2026-11-11 el gestor
//: tampoco escribe (no tiene módulos habilitados en esta versión).
export const ROLES_ESCRITURA = new Set(["administrador"]);

//: D26 punto 4: el Plan de Acción lo consultan `administrador` y `visitante`.
export const ROLES_PLAN_ACCION = new Set(["administrador", "visitante"]);

//: D37: roles con al menos un módulo habilitado en esta versión. Espeja
//: `LecturaDep` en `app/core/dependencias.py`.
export const ROLES_CON_MODULOS = new Set(["administrador", "visitante"]);

//: Roles de GovSync que existen en el realm pero hoy no tienen ningún
//: módulo (D37). Cuando la Épica 3 entre, el gestor sale de esta lista.
export const ROLES_SIN_MODULOS = new Set(["gestor"]);

function tieneAlguno(roles, permitidos) {
  return (roles ?? []).some((rol) => permitidos.has(rol));
}

//: [E-01/HU-01] CA05: los tres roles de GovSync. Toda cuenta del realm trae
//: además `default-roles-*`, `offline_access` y `uma_authorization`; "sin
//: rol" se decide contra esta lista, no contra `roles.length`.
export const ROLES_GOVSYNC = new Set(["administrador", "gestor", "visitante"]);

export function puedeEscribir(roles) {
  return tieneAlguno(roles, ROLES_ESCRITURA);
}

export function puedeVerPlanAccion(roles) {
  return tieneAlguno(roles, ROLES_PLAN_ACCION);
}

/**
 * D37: la cuenta tiene un rol de GovSync válido pero ninguno con módulos
 * (hoy, solo `gestor`). Una cuenta con `gestor` y además `administrador`
 * entra normalmente: manda el rol con más permisos.
 *
 * Una cuenta SIN ningún rol de GovSync no entra aquí: ese es el CA05 de
 * E-01/HU-01 ("Su cuenta no tiene un rol asignado"), con su propio mensaje.
 */
export function tieneSoloRolesSinModulos(roles) {
  return (
    tieneAlguno(roles, ROLES_SIN_MODULOS) &&
    !tieneAlguno(roles, ROLES_CON_MODULOS)
  );
}

/**
 * [E-01/HU-01] CA05 + D37: por qué una sesión válida no puede usar ningún
 * módulo, o `null` si puede.
 *
 * - `"sin_rol"`: la cuenta no tiene ningún rol de GovSync (CA05).
 * - `"rol_sin_modulos"`: tiene solo roles sin módulos, hoy `gestor` (D37).
 *
 * Es la única fuente de esa decisión: `RutaProtegida` elige la pantalla con
 * este valor y no con booleanos sueltos que puedan contradecirse.
 */
export function motivoSinAcceso(roles) {
  if (!tieneAlguno(roles, ROLES_GOVSYNC)) return "sin_rol";
  if (tieneSoloRolesSinModulos(roles)) return "rol_sin_modulos";
  return null;
}

/**
 * [E-01/HU-01] CA01 (decisión del PO, 2026-11-16): vista inicial por rol.
 * Administrador → Cortes; visitante → Plan de Acción. Con ambos roles manda
 * el de más permisos. `null` si el rol no tiene módulos (ve una pantalla de
 * "sin acceso", no una vista).
 */
export function vistaInicial(roles) {
  if (tieneAlguno(roles, ROLES_ESCRITURA)) return "/cortes";
  if (tieneAlguno(roles, ROLES_PLAN_ACCION)) return "/plan-accion";
  return null;
}

/**
 * Nombre del rol en palabras para el encabezado (CA01): nunca el código del
 * realm. Solo los roles con módulos tienen etiqueta, porque son los únicos
 * que llegan a ver el encabezado. Con varios roles manda el de más permisos.
 */
export function etiquetaRol(roles) {
  if (tieneAlguno(roles, ROLES_ESCRITURA)) return "Administradora";
  if (tieneAlguno(roles, ROLES_PLAN_ACCION)) return "Visitante";
  return null;
}

//: Espeja DOS cosas que viven en otros lugares: el guarda `RutaConPlanAccion`
//: de `App.jsx` y la restricción a escritura que cada pantalla de `cortes`
//: aplica por dentro (`NuevoCorte`, `EditarArchivosCorteActual`), no en el
//: router. Una ruta nueva cae en "permitida" por defecto: si es de escritura o
//: de un rol concreto, agregarla aquí. Insensible a mayúsculas porque React Router también
//: lo es: "/Plan-Accion" abre la misma pantalla que "/plan-accion".
const RUTA_PLAN_ACCION = /^\/plan-accion(?:\/|$)/i;
const RUTA_ESCRITURA = /^\/cortes\/[^/]+(?:\/editar)?\/?$/i;

/**
 * [E-01/HU-01] CA07: ¿puede este rol abrir la ruta que pidió antes de iniciar
 * sesión? Solo decide a dónde lleva el login; el acceso real lo impone el
 * backend con 403. Ante la duda, la respuesta es "no" (cae a la vista inicial).
 * Si cambia una ruta o un guarda en `App.jsx`, cambia aquí.
 */
export function puedeAbrirRuta(ruta, roles) {
  if (typeof ruta !== "string") return false;
  if (motivoSinAcceso(roles) !== null) return false;
  let camino = ruta.split(/[?#]/)[0];
  // React Router decodifica el camino: "/%63ortes/nuevo" abre "/cortes/nuevo".
  try {
    camino = decodeURI(camino);
  } catch {
    return false;
  }
  if (RUTA_PLAN_ACCION.test(camino)) return puedeVerPlanAccion(roles);
  // "/cortes/nuevo", "/cortes/:id" (reanudar borrador) y "/cortes/:id/editar".
  if (RUTA_ESCRITURA.test(camino)) return puedeEscribir(roles);
  return true;
}
