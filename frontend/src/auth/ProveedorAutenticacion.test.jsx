/**
 * Pruebas del cableado real de `ProveedorAutenticacion`.
 *
 * TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
 * DECISIÓN: D37 (docs/DECISIONES.md).
 *
 * `App.test.jsx` simula `useAutenticacion`; aquí se usa el proveedor de
 * verdad y solo se simula Keycloak, para comprobar que los roles del token
 * llegan a `rolSinModulos`, `puedeEscribir` y `puedeVerPlanAccion`.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { keycloakSimulado } = vi.hoisted(() => ({
  keycloakSimulado: {
    init: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    updateToken: vi.fn(),
    clearToken: vi.fn(),
    token: "token-de-prueba",
    tokenParsed: { preferred_username: "prueba", email: null },
    realmAccess: { roles: [] },
  },
}));

vi.mock("./keycloak.js", () => ({ default: keycloakSimulado }));
vi.mock("../api/cliente.js", () => ({ establecerProveedorToken: vi.fn() }));

import {
  ProveedorAutenticacion,
  useAutenticacion,
} from "./ProveedorAutenticacion.jsx";

function Sonda() {
  const { cargando, rolSinModulos, puedeEscribir, puedeVerPlanAccion } =
    useAutenticacion();
  if (cargando) return <p>cargando</p>;
  return (
    <ul>
      <li>rolSinModulos={String(rolSinModulos)}</li>
      <li>puedeEscribir={String(puedeEscribir)}</li>
      <li>puedeVerPlanAccion={String(puedeVerPlanAccion)}</li>
    </ul>
  );
}

async function renderizarConRoles(roles) {
  keycloakSimulado.realmAccess = { roles };
  render(
    <ProveedorAutenticacion>
      <Sonda />
    </ProveedorAutenticacion>,
  );
  await screen.findByText(/rolSinModulos=/);
}

beforeEach(() => {
  keycloakSimulado.init.mockReset().mockResolvedValue(true);
});

describe("ProveedorAutenticacion: permisos según los roles del token", () => {
  it("gestor: sin módulos, sin escritura, sin plan de acción", async () => {
    await renderizarConRoles(["gestor", "default-roles-govsync"]);

    expect(screen.getByText("rolSinModulos=true")).toBeInTheDocument();
    expect(screen.getByText("puedeEscribir=false")).toBeInTheDocument();
    expect(screen.getByText("puedeVerPlanAccion=false")).toBeInTheDocument();
  });

  it("administrador: con módulos y con escritura", async () => {
    await renderizarConRoles(["administrador"]);

    expect(screen.getByText("rolSinModulos=false")).toBeInTheDocument();
    expect(screen.getByText("puedeEscribir=true")).toBeInTheDocument();
  });

  it("visitante: lee, no escribe, ve el plan de acción", async () => {
    await renderizarConRoles(["visitante"]);

    expect(screen.getByText("rolSinModulos=false")).toBeInTheDocument();
    expect(screen.getByText("puedeEscribir=false")).toBeInTheDocument();
    expect(screen.getByText("puedeVerPlanAccion=true")).toBeInTheDocument();
  });

  it("gestor + visitante: entra con los permisos del visitante", async () => {
    await renderizarConRoles(["gestor", "visitante"]);

    expect(screen.getByText("rolSinModulos=false")).toBeInTheDocument();
  });

  it("sin roles de GovSync: no es rol sin módulos (es el CA05)", async () => {
    await renderizarConRoles(["default-roles-govsync", "offline_access"]);

    expect(screen.getByText("rolSinModulos=false")).toBeInTheDocument();
  });
});
