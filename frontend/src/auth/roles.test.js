/**
 * Pruebas de `roles.js` (lógica pura, sin DOM).
 *
 * TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
 * DECISIÓN: D37 (docs/DECISIONES.md).
 */
import { describe, expect, it } from "vitest";
import {
  etiquetaRol,
  motivoSinAcceso,
  puedeAbrirRuta,
  puedeEscribir,
  puedeVerPlanAccion,
  tieneSoloRolesSinModulos,
  vistaInicial,
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

describe("motivoSinAcceso (CA05 + D37)", () => {
  it.each([
    [["administrador"], null],
    [["visitante"], null],
    [["administrador", "visitante"], null],
    [["gestor", "administrador"], null],
    [["gestor", "visitante"], null],
    [["gestor"], "rol_sin_modulos"],
    [["gestor", ...ROLES_DEL_REALM], "rol_sin_modulos"],
    [ROLES_DEL_REALM, "sin_rol"],
    [["default-roles-govsync"], "sin_rol"],
    [[], "sin_rol"],
    [undefined, "sin_rol"],
    [null, "sin_rol"],
  ])("%j → %s", (roles, esperado) => {
    expect(motivoSinAcceso(roles)).toBe(esperado);
  });

  it("no reconoce un rol por parecido ni por mayúsculas", () => {
    expect(motivoSinAcceso(["Administrador"])).toBe("sin_rol");
    expect(motivoSinAcceso(["administrador-ficticio"])).toBe("sin_rol");
  });

  it("los roles del realm no quitan el acceso a quien tiene un rol con módulos", () => {
    expect(motivoSinAcceso(["administrador", ...ROLES_DEL_REALM])).toBeNull();
    expect(motivoSinAcceso(["visitante", ...ROLES_DEL_REALM])).toBeNull();
  });
});

describe("vistaInicial (CA01)", () => {
  it("administrador → /cortes; visitante → /plan-accion", () => {
    expect(vistaInicial(["administrador"])).toBe("/cortes");
    expect(vistaInicial(["visitante"])).toBe("/plan-accion");
  });

  it("con ambos roles manda administrador", () => {
    expect(vistaInicial(["visitante", "administrador"])).toBe("/cortes");
  });

  it("gestor y sin rol no tienen vista inicial", () => {
    expect(vistaInicial(["gestor"])).toBeNull();
    expect(vistaInicial(ROLES_DEL_REALM)).toBeNull();
    expect(vistaInicial(undefined)).toBeNull();
  });
});

describe("etiquetaRol (CA01)", () => {
  it("devuelve el rol en palabras, no el código", () => {
    expect(etiquetaRol(["administrador"])).toBe("Administradora");
    expect(etiquetaRol(["visitante"])).toBe("Visitante");
  });

  it("con varios roles manda el de más permisos", () => {
    expect(etiquetaRol(["visitante", "administrador", "gestor"])).toBe(
      "Administradora",
    );
    expect(etiquetaRol(["gestor", "visitante"])).toBe("Visitante");
  });

  it("sin módulos o sin rol no hay etiqueta", () => {
    expect(etiquetaRol(["gestor"])).toBeNull();
    expect(etiquetaRol(ROLES_DEL_REALM)).toBeNull();
    expect(etiquetaRol(undefined)).toBeNull();
  });
});

describe("puedeAbrirRuta (CA07)", () => {
  const ADMIN = ["administrador"];
  const VISITANTE = ["visitante"];

  it.each(["/cortes", "/cortes?vigencia=2026", "/matriz", "/matriz/3", "/"])(
    "administrador y visitante abren %s",
    (ruta) => {
      expect(puedeAbrirRuta(ruta, ADMIN)).toBe(true);
      expect(puedeAbrirRuta(ruta, VISITANTE)).toBe(true);
    },
  );

  it.each([
    "/cortes/nuevo",
    "/cortes/12",
    "/cortes/12/editar",
    "/cortes/12/editar/",
    "/CORTES/Nuevo",
    "/cortes/nuevo?x=1",
    "/cortes/12#seccion",
  ])("solo el administrador abre %s", (ruta) => {
    expect(puedeAbrirRuta(ruta, ADMIN)).toBe(true);
    expect(puedeAbrirRuta(ruta, VISITANTE)).toBe(false);
  });

  it("el plan de acción lo abren administrador y visitante, también en mayúsculas", () => {
    expect(
      puedeAbrirRuta("/plan-accion/comparar?vigencia=2026", VISITANTE),
    ).toBe(true);
    expect(puedeAbrirRuta("/Plan-Accion", ADMIN)).toBe(true);
  });

  it("el gestor y la cuenta sin rol no abren nada", () => {
    expect(puedeAbrirRuta("/cortes", ["gestor"])).toBe(false);
    expect(puedeAbrirRuta("/plan-accion", ["gestor"])).toBe(false);
    expect(puedeAbrirRuta("/cortes", ROLES_DEL_REALM)).toBe(false);
    expect(puedeAbrirRuta("/cortes", undefined)).toBe(false);
  });

  it("no se salta la regla con la URL codificada ni con mayúsculas", () => {
    expect(puedeAbrirRuta("/%63ortes/nuevo", VISITANTE)).toBe(false);
    expect(puedeAbrirRuta("/%63ortes/nuevo", ADMIN)).toBe(true);
    expect(puedeAbrirRuta("/%E0%A4%A", ADMIN)).toBe(false);
  });

  it("un valor que no es texto no se puede abrir", () => {
    expect(puedeAbrirRuta(undefined, ADMIN)).toBe(false);
    expect(puedeAbrirRuta(null, ADMIN)).toBe(false);
    expect(puedeAbrirRuta({}, ADMIN)).toBe(false);
  });
});
