/**
 * Pruebas de `Login.jsx`: el acceso como visitante.
 *
 * TARJETA: [E-01/HU-01] FE - Acceso como visitante sin credenciales
 * DECISIÓN DEL PO: botón "Ingresar como visitante" junto a "Ingresar".
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login.jsx";

const iniciarSesion = vi.fn();
let cargandoActual = false;

vi.mock("../auth/ProveedorAutenticacion.jsx", () => ({
  useAutenticacion: () => ({ iniciarSesion, cargando: cargandoActual }),
}));

function abrirLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/publico/plan-accion" element={<p>Pantalla pública</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  iniciarSesion.mockClear();
  cargandoActual = false;
});

describe("Login: Ingresar como visitante", () => {
  it("lleva a /publico/plan-accion sin iniciar sesión en Keycloak", async () => {
    abrirLogin();

    await userEvent.click(
      screen.getByRole("link", { name: "Ingresar como visitante" }),
    );

    expect(screen.getByText("Pantalla pública")).toBeInTheDocument();
    expect(iniciarSesion).not.toHaveBeenCalled();
  });

  it("está junto a 'Ingresar', que sigue iniciando sesión", async () => {
    abrirLogin();

    expect(
      screen.getByRole("link", { name: "Ingresar como visitante" }),
    ).toHaveAttribute("href", "/publico/plan-accion");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(iniciarSesion).toHaveBeenCalledTimes(1);
  });

  it("sigue disponible mientras se verifica la sesión", () => {
    cargandoActual = true;

    abrirLogin();

    expect(
      screen.getByRole("button", { name: "Verificando sesión…" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Ingresar como visitante" }),
    ).not.toHaveAttribute("aria-disabled");
  });
});
