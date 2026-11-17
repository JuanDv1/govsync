/**
 * Pruebas de `PantallaSinAcceso`.
 *
 * TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PantallaSinAcceso from "./PantallaSinAcceso.jsx";

const cerrarSesion = vi.fn();

vi.mock("../../auth/ProveedorAutenticacion.jsx", () => ({
  useAutenticacion: () => ({ cerrarSesion }),
}));

describe("PantallaSinAcceso", () => {
  it("muestra el mensaje como alerta y cierra la sesión con el botón", async () => {
    render(
      <MemoryRouter>
        <PantallaSinAcceso
          titulo="Su rol no tiene módulos habilitados en esta versión"
          descripcion="Contacte a la administradora."
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Su rol no tiene módulos habilitados en esta versión",
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Su rol no tiene módulos habilitados en esta versión",
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    );

    expect(cerrarSesion).toHaveBeenCalledTimes(1);
  });

  it("ofrece consultar el Plan de Acción como visitante", () => {
    render(
      <MemoryRouter>
        <PantallaSinAcceso titulo="Sin acceso" descripcion="Contacte." />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", {
        name: "Consultar el Plan de Acción como visitante",
      }),
    ).toHaveAttribute("href", "/publico/plan-accion");
  });
});
