/**
 * Pruebas del flujo de entrada de "Comparar cortes".
 *
 * TARJETA: [E04-HU04] Comparar dos cortes de una misma vigencia.
 * Cubre lo que decide qué se muestra antes de comparar: la vigencia de la URL,
 * los cortes disponibles (menos de 2 = no hay qué comparar), el error y su
 * reintento. Se simula `api`; `ErrorApi` es la clase real.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiSimulada } = vi.hoisted(() => ({
  apiSimulada: { cortesDisponibles: vi.fn(), compararCortes: vi.fn() },
}));

vi.mock("../api/cliente.js", async (importarOriginal) => ({
  ...(await importarOriginal()),
  api: apiSimulada,
}));

import { ErrorApi } from "../api/cliente.js";
import CompararCortes from "./CompararCortes.jsx";

const POCOS = "Se necesitan al menos 2 cortes de la vigencia";

const corte = (id, fecha) => ({
  id,
  vigencia: 2026,
  fecha_corte: fecha,
  estado: "REGISTRADO",
});

function abrir(consulta = "?vigencia=2026") {
  return render(
    <MemoryRouter initialEntries={[`/plan-accion/comparar${consulta}`]}>
      <CompararCortes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  // La comparación en sí no se prueba aquí: que nunca responda evita ruido.
  apiSimulada.compararCortes.mockReturnValue(new Promise(() => {}));
});

describe("Comparar cortes: entrada", () => {
  it.each(["", "?vigencia=", "?vigencia=20x6", "?vigencia=26"])(
    "[E04-HU04] sin una vigencia válida (%j) lo explica y no pide cortes",
    (consulta) => {
      abrir(consulta);

      expect(
        screen.getByText("No se indicó la vigencia a comparar"),
      ).toBeInTheDocument();
      expect(apiSimulada.cortesDisponibles).not.toHaveBeenCalled();
    },
  );

  it("[E04-HU04] pide los cortes de la vigencia de la URL", async () => {
    apiSimulada.cortesDisponibles.mockResolvedValue([]);

    abrir("?vigencia=2025");

    expect(await screen.findByText(POCOS)).toBeInTheDocument();
    expect(apiSimulada.cortesDisponibles).toHaveBeenCalledWith(2025);
  });

  it.each([
    [[], "La vigencia 2026 tiene 0 cortes finalizados."],
    [[corte("a", "2026-10-22")], "La vigencia 2026 tiene 1 corte finalizado."],
  ])(
    "[E04-HU04] con menos de 2 cortes avisa que no hay qué comparar",
    async (cortes, descripcion) => {
      apiSimulada.cortesDisponibles.mockResolvedValue(cortes);

      abrir();

      expect(await screen.findByText(POCOS)).toBeInTheDocument();
      expect(screen.getByText(descripcion)).toBeInTheDocument();
    },
  );

  it("[E04-HU04] con 2 cortes muestra la comparación, no el aviso", async () => {
    apiSimulada.cortesDisponibles.mockResolvedValue([
      corte("a", "2026-10-22"),
      corte("b", "2026-09-01"),
    ]);

    abrir();

    await screen.findByText("Vigencia 2026");
    expect(await screen.findAllByRole("combobox")).not.toHaveLength(0);
    expect(screen.queryByText(POCOS)).not.toBeInTheDocument();
  });

  it("[E04-HU04] un error de red ofrece Reintentar, que vuelve a pedir los cortes", async () => {
    apiSimulada.cortesDisponibles
      .mockRejectedValueOnce(
        new ErrorApi("Falló.", { codigo: "error_interno", estado: 500 }),
      )
      .mockResolvedValueOnce([]);
    const usuario = userEvent.setup();

    abrir();
    expect(
      await screen.findByText(/No fue posible cargar los cortes/),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Reintentar/ }));

    expect(await screen.findByText(POCOS)).toBeInTheDocument();
    expect(apiSimulada.cortesDisponibles).toHaveBeenCalledTimes(2);
  });

  it("[E04-HU04] un 403 no se presenta como un fallo de red", async () => {
    apiSimulada.cortesDisponibles.mockRejectedValue(
      new ErrorApi("Prohibido.", { codigo: "prohibido", estado: 403 }),
    );

    abrir();

    await screen.findByRole("alert");
    expect(
      screen.queryByText(/No fue posible cargar los cortes/),
    ).not.toBeInTheDocument();
  });
});
