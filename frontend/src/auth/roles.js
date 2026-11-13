/**
 * Reglas de rol del frontend, en un solo lugar y sin React.
 *
 * TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
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
