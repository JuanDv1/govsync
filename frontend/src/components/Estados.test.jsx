import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Error as EstadoError } from "./Estados.jsx";

describe("Estados::Error", () => {
  it("no renderiza nada si no hay error", () => {
    const { container } = render(<EstadoError error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra los detalles accionables del backend (columnas y pestañas faltantes)", () => {
    render(
      <EstadoError
        error={{
          message: "El archivo no tiene el formato esperado.",
          codigo: "archivo_invalido",
          detalles: {
            columnas_faltantes: ["meta", "avance"],
            pestanas_faltantes: [],
          },
        }}
      />,
    );

    expect(
      screen.getByText("El archivo no tiene el formato esperado."),
    ).toBeInTheDocument();
    expect(screen.getByText("archivo_invalido")).toBeInTheDocument();
    expect(
      screen.getByText("Columnas faltantes: meta, avance"),
    ).toBeInTheDocument();
    // Una lista vacía se filtra en vez de mostrarse como "Pestañas faltantes: ".
    expect(screen.queryByText(/Pestañas faltantes/)).not.toBeInTheDocument();
  });

  it("etiqueta genéricamente una clave de detalle desconocida", () => {
    render(
      <EstadoError
        error={{ message: "Error", detalles: { motivo_interno: "x" } }}
      />,
    );

    expect(screen.getByText("Motivo interno: x")).toBeInTheDocument();
  });

  it("invoca onReintentar al hacer clic en el botón", async () => {
    const usuario = userEvent.setup();
    const alReintentar = vi.fn();

    render(
      <EstadoError error={{ message: "Error" }} onReintentar={alReintentar} />,
    );

    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(alReintentar).toHaveBeenCalledTimes(1);
  });
});
