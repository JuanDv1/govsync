import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App.jsx";

describe("App", () => {
  it("renderiza el layout base y la navegación principal sin errores", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    // El logo se renderiza como "GOV" + <span>SYNC</span>, texto partido en
    // dos nodos, así que se verifica con "Plan de Desarrollo" (nodo único).
    expect(screen.getByText("Plan de Desarrollo")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cortes" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nuevo corte" }),
    ).toBeInTheDocument();
  });
});
