/**
 * Pruebas de `RutaProtegida` (App.jsx) para el rol sin módulos.
 *
 * TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
 * DECISIÓN: D37 (docs/DECISIONES.md).
 *
 * Se simula `useAutenticacion` con las mismas reglas de `auth/roles.js` que
 * usa el proveedor real, y se reemplaza el cliente HTTP por funciones
 * espía: así se comprueba que, para el gestor, ninguna pantalla se monta ni
 * dispara una petición, entre por donde entre.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

const MENSAJE = "Su rol no tiene módulos habilitados en esta versión";
let rolesActuales = [];

vi.mock("./auth/ProveedorAutenticacion.jsx", async () => {
  const roles = await import("./auth/roles.js");
  return {
    useAutenticacion: () => ({
      cargando: false,
      estaAutenticado: true,
      usuario: { nombre: "prueba", correo: null, roles: rolesActuales },
      puedeEscribir: roles.puedeEscribir(rolesActuales),
      puedeVerPlanAccion: roles.puedeVerPlanAccion(rolesActuales),
      rolSinModulos: roles.tieneSoloRolesSinModulos(rolesActuales),
      iniciarSesion: vi.fn(),
      cerrarSesion: vi.fn(),
    }),
  };
});

//: Cada método del cliente devuelve una promesa que nunca se resuelve: basta
//: para saber si alguna pantalla intentó pedir datos.
const llamadasApi = vi.fn();
vi.mock("./api/cliente.js", () => ({
  establecerProveedorToken: vi.fn(),
  ErrorApi: class ErrorApi extends Error {},
  api: new Proxy(
    {},
    {
      get: (_objetivo, metodo) => () => {
        llamadasApi(metodo);
        return new Promise(() => {});
      },
    },
  ),
}));

function renderizarEn(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  llamadasApi.mockClear();
});

afterEach(() => {
  rolesActuales = [];
});

describe("RutaProtegida con rol sin módulos (gestor)", () => {
  it.each([
    "/cortes",
    "/cortes/nuevo",
    "/plan-accion",
    "/plan-accion/comparar",
    "/matriz",
    "/ruta-que-no-existe",
  ])("en %s muestra la pantalla, sin menú ni peticiones", (ruta) => {
    rolesActuales = ["gestor", "default-roles-govsync", "offline_access"];

    renderizarEn(ruta);

    expect(screen.getByRole("alert")).toHaveTextContent(MENSAJE);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(llamadasApi).not.toHaveBeenCalled();
  });

  it("gestor + visitante entra con el layout del visitante", () => {
    rolesActuales = ["gestor", "visitante"];

    renderizarEn("/cortes");

    expect(screen.queryByText(MENSAJE)).not.toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("administrador no ve la pantalla", () => {
    rolesActuales = ["administrador"];

    renderizarEn("/cortes");

    expect(screen.queryByText(MENSAJE)).not.toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("una cuenta sin rol de GovSync no ve esta pantalla (es CA05, otro mensaje)", () => {
    rolesActuales = ["default-roles-govsync", "offline_access"];

    renderizarEn("/cortes");

    expect(screen.queryByText(MENSAJE)).not.toBeInTheDocument();
  });
});
