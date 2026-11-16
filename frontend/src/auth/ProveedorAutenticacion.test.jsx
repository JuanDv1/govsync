/**
 * Pruebas del cableado real de `ProveedorAutenticacion`.
 *
 * TARJETAS: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados
 * (gestor) y FE - Completar inicio de sesión.
 * DECISIONES: D37 (docs/DECISIONES.md) y las del PO del 2026-11-16.
 *
 * `App.test.jsx` simula `useAutenticacion`; aquí se usa el proveedor de
 * verdad y solo se simula Keycloak, para comprobar que los roles del token
 * llegan a `motivoSinAcceso`, `vistaInicial`, el rol del encabezado y los
 * permisos, y que el login y la inactividad llaman a Keycloak como deben.
 */
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { INACTIVIDAD_MS } from "./useInactividad.js";

let contexto;

function Sonda() {
  const valor = useAutenticacion();
  // Fuera del render: la prueba lee el contexto para llamar sus acciones.
  useEffect(() => {
    contexto = valor;
  });
  const {
    cargando,
    motivoSinAcceso,
    vistaInicial,
    puedeEscribir,
    puedeVerPlanAccion,
    usuario,
    loginReciente,
  } = valor;
  if (cargando) return <p>cargando</p>;
  return (
    <ul>
      <li>motivoSinAcceso={String(motivoSinAcceso)}</li>
      <li>vistaInicial={String(vistaInicial)}</li>
      <li>puedeEscribir={String(puedeEscribir)}</li>
      <li>puedeVerPlanAccion={String(puedeVerPlanAccion)}</li>
      <li>rol={String(usuario?.rol)}</li>
      <li>nombre={String(usuario?.nombre)}</li>
      <li>loginReciente={String(loginReciente)}</li>
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
  await screen.findByText(/motivoSinAcceso=/);
}

beforeEach(() => {
  keycloakSimulado.init.mockReset().mockResolvedValue(true);
  keycloakSimulado.login.mockReset();
  keycloakSimulado.logout.mockReset();
  keycloakSimulado.tokenParsed = { preferred_username: "prueba", email: null };
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProveedorAutenticacion: permisos según los roles del token", () => {
  it("gestor: rol sin módulos, sin escritura, sin plan de acción, sin vista", async () => {
    await renderizarConRoles(["gestor", "default-roles-govsync"]);

    expect(
      screen.getByText("motivoSinAcceso=rol_sin_modulos"),
    ).toBeInTheDocument();
    expect(screen.getByText("vistaInicial=null")).toBeInTheDocument();
    expect(screen.getByText("puedeEscribir=false")).toBeInTheDocument();
    expect(screen.getByText("puedeVerPlanAccion=false")).toBeInTheDocument();
  });

  it("administrador: entra, escribe y su vista inicial es /cortes", async () => {
    await renderizarConRoles(["administrador"]);

    expect(screen.getByText("motivoSinAcceso=null")).toBeInTheDocument();
    expect(screen.getByText("vistaInicial=/cortes")).toBeInTheDocument();
    expect(screen.getByText("puedeEscribir=true")).toBeInTheDocument();
    expect(screen.getByText("rol=Administradora")).toBeInTheDocument();
  });

  it("visitante: lee, no escribe, su vista inicial es /plan-accion", async () => {
    await renderizarConRoles(["visitante"]);

    expect(screen.getByText("motivoSinAcceso=null")).toBeInTheDocument();
    expect(screen.getByText("vistaInicial=/plan-accion")).toBeInTheDocument();
    expect(screen.getByText("puedeEscribir=false")).toBeInTheDocument();
    expect(screen.getByText("puedeVerPlanAccion=true")).toBeInTheDocument();
    expect(screen.getByText("rol=Visitante")).toBeInTheDocument();
  });

  it("gestor + visitante: entra con los permisos del visitante", async () => {
    await renderizarConRoles(["gestor", "visitante"]);

    expect(screen.getByText("motivoSinAcceso=null")).toBeInTheDocument();
  });

  it("sin roles de GovSync: motivo 'sin_rol' (CA05)", async () => {
    await renderizarConRoles(["default-roles-govsync", "offline_access"]);

    expect(screen.getByText("motivoSinAcceso=sin_rol")).toBeInTheDocument();
    expect(screen.getByText("rol=null")).toBeInTheDocument();
  });

  it("el nombre es el nombre completo y, sin él, el usuario", async () => {
    keycloakSimulado.tokenParsed = {
      name: "Ana Pérez",
      preferred_username: "aperez",
    };
    await renderizarConRoles(["administrador"]);
    expect(screen.getByText("nombre=Ana Pérez")).toBeInTheDocument();
  });

  it("sin nombre completo usa el nombre de usuario", async () => {
    await renderizarConRoles(["administrador"]);
    expect(screen.getByText("nombre=prueba")).toBeInTheDocument();
  });

  it("sin sesión no hay motivo de bloqueo ni usuario", async () => {
    keycloakSimulado.init.mockResolvedValue(false);
    await renderizarConRoles(["administrador"]);

    expect(screen.getByText("motivoSinAcceso=null")).toBeInTheDocument();
    expect(screen.getByText("vistaInicial=null")).toBeInTheDocument();
    expect(screen.getByText("rol=undefined")).toBeInTheDocument();
  });
});

describe("ProveedorAutenticacion: inicio de sesión (CA07)", () => {
  it("vuelve a la ruta pedida y deja la marca de login reciente", async () => {
    await renderizarConRoles(["administrador"]);

    contexto.iniciarSesion("/plan-accion/comparar?vigencia=2026");

    expect(keycloakSimulado.login).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/plan-accion/comparar?vigencia=2026`,
    });
    expect(window.sessionStorage.getItem("govsync.loginReciente")).toBe("1");
  });

  it.each(["//evil.com", "https://evil.com", "/login", undefined])(
    "con destino no válido (%j) vuelve a '/' (vista inicial)",
    async (destino) => {
      await renderizarConRoles(["administrador"]);

      contexto.iniciarSesion(destino);

      expect(keycloakSimulado.login).toHaveBeenCalledWith({
        redirectUri: `${window.location.origin}/`,
      });
    },
  );

  it("tras volver del login con sesión, `loginReciente` es true", async () => {
    window.sessionStorage.setItem("govsync.loginReciente", "1");

    await renderizarConRoles(["visitante"]);

    expect(screen.getByText("loginReciente=true")).toBeInTheDocument();
    // La marca se consume: una recarga posterior ya no la ve.
    expect(window.sessionStorage.getItem("govsync.loginReciente")).toBeNull();
  });

  it("`finalizarLoginReciente` la apaga", async () => {
    window.sessionStorage.setItem("govsync.loginReciente", "1");
    await renderizarConRoles(["visitante"]);

    act(() => contexto.finalizarLoginReciente());

    expect(screen.getByText("loginReciente=false")).toBeInTheDocument();
  });

  it("sin marca (URL escrita con la sesión abierta) no es login reciente", async () => {
    await renderizarConRoles(["visitante"]);

    expect(screen.getByText("loginReciente=false")).toBeInTheDocument();
  });

  it("si la sesión no se recuperó, la marca no sobrevive ni vale", async () => {
    window.sessionStorage.setItem("govsync.loginReciente", "1");
    keycloakSimulado.init.mockResolvedValue(false);

    await renderizarConRoles(["visitante"]);

    expect(screen.getByText("loginReciente=false")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("govsync.loginReciente")).toBeNull();
  });

  it("si Keycloak falla al iniciar, la marca se limpia", async () => {
    window.sessionStorage.setItem("govsync.loginReciente", "1");
    keycloakSimulado.init.mockRejectedValue(new Error("sin red"));

    await renderizarConRoles(["visitante"]);

    expect(window.sessionStorage.getItem("govsync.loginReciente")).toBeNull();
  });
});

describe("ProveedorAutenticacion: inactividad (CA04)", () => {
  it("a los 30 min sin actividad cierra la sesión con el motivo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    keycloakSimulado.realmAccess = { roles: ["administrador"] };
    render(
      <ProveedorAutenticacion>
        <Sonda />
      </ProveedorAutenticacion>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INACTIVIDAD_MS + 15_000);
    });

    expect(keycloakSimulado.logout).toHaveBeenCalledTimes(1);
    expect(keycloakSimulado.logout).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/login?motivo=inactividad`,
    });
  });

  it("sin sesión no vigila la inactividad", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    keycloakSimulado.init.mockResolvedValue(false);
    render(
      <ProveedorAutenticacion>
        <Sonda />
      </ProveedorAutenticacion>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INACTIVIDAD_MS * 2);
    });

    expect(keycloakSimulado.logout).not.toHaveBeenCalled();
  });
});
