/**
 * Pruebas de `PantallaSinAcceso`.
 *
 * TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PantallaSinAcceso from "./PantallaSinAcceso.jsx";

const cerrarSesion = vi.fn();

vi.mock("../../auth/ProveedorAutenticacion.jsx", () => ({
  useAutenticacion: () => ({ cerrarSesion }),
}));

describe("PantallaSinAcceso", () => {
  it("muestra el mensaje como alerta y cierra la sesión con el botón", async () => {
    render(
      <PantallaSinAcceso
        titulo="Su rol no tiene módulos habilitados en esta versión"
        descripcion="Contacte a la administradora."
      />,
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
});
