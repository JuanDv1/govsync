/**
 * Pruebas de `roles.js` (lógica pura, sin DOM).
 *
 * TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
 * DECISIÓN: D37 (docs/DECISIONES.md).
 */
import { describe, expect, it } from "vitest";
import {
  puedeEscribir,
  puedeVerPlanAccion,
  tieneSoloRolesSinModulos,
} from "./roles";

//: Roles que Keycloak agrega a toda cuenta del realm.
const ROLES_DEL_REALM = [
  "default-roles-govsync",
  "offline_access",
  "uma_authorization",
];

describe("tieneSoloRolesSinModulos", () => {
  it("es verdadero para una cuenta que solo tiene gestor", () => {
    expect(tieneSoloRolesSinModulos(["gestor", ...ROLES_DEL_REALM])).toBe(true);
  });

  it("es falso si la cuenta también tiene un rol con módulos", () => {
    expect(tieneSoloRolesSinModulos(["gestor", "administrador"])).toBe(false);
    expect(tieneSoloRolesSinModulos(["gestor", "visitante"])).toBe(false);
  });

  it("es falso para administrador y visitante", () => {
    expect(tieneSoloRolesSinModulos(["administrador"])).toBe(false);
    expect(tieneSoloRolesSinModulos(["visitante"])).toBe(false);
  });

  it("es falso para una cuenta sin rol de GovSync (eso es CA05, otro mensaje)", () => {
    expect(tieneSoloRolesSinModulos(ROLES_DEL_REALM)).toBe(false);
    expect(tieneSoloRolesSinModulos([])).toBe(false);
    expect(tieneSoloRolesSinModulos(undefined)).toBe(false);
  });
});

describe("puedeEscribir", () => {
  it("solo administrador escribe (D24 + D37)", () => {
    expect(puedeEscribir(["administrador"])).toBe(true);
    expect(puedeEscribir(["gestor"])).toBe(false);
    expect(puedeEscribir(["visitante"])).toBe(false);
    expect(puedeEscribir(undefined)).toBe(false);
  });
});

describe("puedeVerPlanAccion", () => {
  it("administrador y visitante, no gestor (D26)", () => {
    expect(puedeVerPlanAccion(["administrador"])).toBe(true);
    expect(puedeVerPlanAccion(["visitante"])).toBe(true);
    expect(puedeVerPlanAccion(["gestor"])).toBe(false);
  });
});
