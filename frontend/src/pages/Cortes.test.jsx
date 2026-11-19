/**
 * Pruebas del histórico de cortes: columna "Metas" (E02-HU08/CA03) y estrella
 * de referencia por vigencia (E02-HU08/CA04).
 *
 * Se simula `api` y la autenticación (el backend ya tiene sus propias
 * pruebas); la regla "una estrella por vigencia" la aplica el backend, así
 * que el simulador de `marcarCorteReferencia` la reproduce al recargar.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiSimulada, estadoAutenticacion } = vi.hoisted(() => ({
  apiSimulada: {
    listarCortes: vi.fn(),
    marcarCorteReferencia: vi.fn(),
    desmarcarCorteReferencia: vi.fn(),
  },
  estadoAutenticacion: { puedeEscribir: true },
}));

// Solo se simula `api`; `ErrorApi` es la clase real, para que los errores de
// las pruebas tengan exactamente la forma que produce el cliente.
vi.mock("../api/cliente.js", async (importarOriginal) => ({
  ...(await importarOriginal()),
  api: apiSimulada,
}));
vi.mock("../auth/ProveedorAutenticacion.jsx", () => ({
  useAutenticacion: () => estadoAutenticacion,
}));

import { ErrorApi } from "../api/cliente.js";
import Cortes from "./Cortes.jsx";

function corte(id, sobrescribir = {}) {
  return {
    id,
    vigencia: 2026,
    fecha_corte: "2026-10-22",
    estado: "REGISTRADO",
    archivos: [],
    es_corte_actual: false,
    es_referencia: false,
    cantidad_metas: 10,
    ...sobrescribir,
  };
}

// Orden del backend: más reciente primero.
function listaBase() {
  return [
    corte("a", { fecha_corte: "2026-10-22", es_corte_actual: true }),
    corte("b", { fecha_corte: "2026-09-01", es_referencia: true }),
    corte("c", {
      vigencia: 2025,
      fecha_corte: "2025-06-30",
      es_referencia: true,
      cantidad_metas: 0,
    }),
  ];
}

function renderizar() {
  return render(
    <MemoryRouter>
      <Cortes />
    </MemoryRouter>,
  );
}

function filaDe(fecha) {
  return screen.getByText(fecha).closest("tr");
}

function botonDe(fecha, nombre) {
  return within(filaDe(fecha)).getByRole("button", { name: nombre });
}

// Monta la pantalla, espera la tabla y devuelve el usuario simulado.
async function abrirHistorico() {
  const usuario = userEvent.setup();
  renderizar();
  await screen.findByText("2026-10-22");
  return usuario;
}

// Lo que devolvería GET /cortes tras mover o quitar la marca de 2026.
function listaConReferencia(idReferencia) {
  return [
    corte("a", {
      fecha_corte: "2026-10-22",
      es_corte_actual: true,
      es_referencia: idReferencia === "a",
    }),
    corte("b", {
      fecha_corte: "2026-09-01",
      es_referencia: idReferencia === "b",
    }),
    listaBase()[2],
  ];
}

const ESTRELLA_2026 = "Corte de referencia de la vigencia 2026";
const ESTRELLA_2025 = "Corte de referencia de la vigencia 2025";

beforeEach(() => {
  vi.clearAllMocks();
  estadoAutenticacion.puedeEscribir = true;
  apiSimulada.listarCortes.mockResolvedValue(listaBase());
});

describe("columna Metas (CA03)", () => {
  it("muestra el número, 0 en un REGISTRADO sin metas y — si es null", async () => {
    apiSimulada.listarCortes.mockResolvedValue([
      corte("a", { fecha_corte: "2026-10-22", cantidad_metas: 144 }),
      corte("b", { fecha_corte: "2026-09-01", cantidad_metas: 0 }),
      corte("c", {
        fecha_corte: "2026-08-01",
        estado: "BORRADOR",
        cantidad_metas: null,
      }),
    ]);
    renderizar();
    await screen.findByText("2026-10-22");

    expect(
      screen.getByRole("columnheader", { name: "Metas" }),
    ).toBeInTheDocument();
    expect(within(filaDe("2026-10-22")).getByText("144")).toBeInTheDocument();
    expect(within(filaDe("2026-09-01")).getByText("0")).toBeInTheDocument();
    const borrador = within(filaDe("2026-08-01"));
    expect(borrador.getByText("—")).toBeInTheDocument();
    expect(borrador.queryByText("0")).not.toBeInTheDocument();
  });

  it("si el backend no manda el campo (undefined) tampoco inventa 0", async () => {
    const sinCampo = corte("a", { fecha_corte: "2026-10-22" });
    delete sinCampo.cantidad_metas;
    apiSimulada.listarCortes.mockResolvedValue([sinCampo]);
    renderizar();
    await screen.findByText("2026-10-22");

    expect(within(filaDe("2026-10-22")).getByText("—")).toBeInTheDocument();
  });
});

describe("estrella de referencia (CA04): visibilidad y permisos", () => {
  it("el visitante ve la estrella con su texto pero ningún botón de referencia", async () => {
    estadoAutenticacion.puedeEscribir = false;
    renderizar();
    await screen.findByText("2026-10-22");

    expect(screen.getByText(ESTRELLA_2026)).toBeInTheDocument();
    expect(screen.getByText(ESTRELLA_2025)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /referencia/i }),
    ).not.toBeInTheDocument();
  });

  it("el administrador ve Marcar en los no marcados y Quitar en los marcados", async () => {
    renderizar();
    await screen.findByText("2026-10-22");

    expect(botonDe("2026-10-22", /Marcar referencia/)).toBeInTheDocument();
    expect(botonDe("2026-09-01", /Quitar referencia/)).toBeInTheDocument();
  });

  it("no ofrece la acción en un BORRADOR", async () => {
    apiSimulada.listarCortes.mockResolvedValue([
      corte("a", {
        fecha_corte: "2026-10-22",
        estado: "BORRADOR",
        cantidad_metas: null,
      }),
    ]);
    renderizar();
    await screen.findByText("2026-10-22");

    expect(
      screen.queryByRole("button", { name: /referencia/i }),
    ).not.toBeInTheDocument();
  });
});

describe("estrella de referencia (CA04): marcar y quitar", () => {
  it("al marcar otro corte la estrella se mueve dentro de su vigencia y no toca otra", async () => {
    // El backend mueve la marca; el simulador lo reproduce en la recarga.
    apiSimulada.marcarCorteReferencia.mockImplementation(async () => {
      apiSimulada.listarCortes.mockResolvedValue(listaConReferencia("a"));
      return {};
    });
    const usuario = await abrirHistorico();

    await usuario.click(botonDe("2026-10-22", /Marcar referencia/));

    await waitFor(() =>
      expect(
        within(filaDe("2026-10-22")).getByText(ESTRELLA_2026),
      ).toBeInTheDocument(),
    );
    expect(apiSimulada.marcarCorteReferencia).toHaveBeenCalledWith("a");
    expect(screen.getAllByText(ESTRELLA_2026)).toHaveLength(1);
    expect(
      within(filaDe("2026-09-01")).queryByText(ESTRELLA_2026),
    ).not.toBeInTheDocument();
    // La vigencia 2025 queda intacta.
    expect(
      within(filaDe("2025-06-30")).getByText(ESTRELLA_2025),
    ).toBeInTheDocument();
  });

  it("Quitar referencia llama al DELETE y recarga la lista", async () => {
    apiSimulada.desmarcarCorteReferencia.mockImplementation(async () => {
      apiSimulada.listarCortes.mockResolvedValue(listaConReferencia(null));
      return {};
    });
    const usuario = await abrirHistorico();

    await usuario.click(botonDe("2026-09-01", /Quitar referencia/));

    await waitFor(() =>
      expect(screen.queryByText(ESTRELLA_2026)).not.toBeInTheDocument(),
    );
    expect(apiSimulada.desmarcarCorteReferencia).toHaveBeenCalledWith("b");
    expect(screen.getByText(ESTRELLA_2025)).toBeInTheDocument();
  });

  it("un 409 se muestra con sus detalles y la lista queda como estaba", async () => {
    apiSimulada.marcarCorteReferencia.mockRejectedValue(
      new ErrorApi("El corte no está registrado.", {
        estado: 409,
        codigo: "regla_de_negocio_violada",
        detalles: { estado: "BORRADOR" },
      }),
    );
    const usuario = await abrirHistorico();

    await usuario.click(botonDe("2026-10-22", /Marcar referencia/));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("El corte no está registrado.");
    expect(alerta).toHaveTextContent("Estado: BORRADOR");
    // No se recargó: sigue la misma estrella y la misma tabla.
    expect(apiSimulada.listarCortes).toHaveBeenCalledTimes(1);
    expect(
      within(filaDe("2026-09-01")).getByText(ESTRELLA_2026),
    ).toBeInTheDocument();
    expect(
      within(filaDe("2026-10-22")).queryByText(ESTRELLA_2026),
    ).not.toBeInTheDocument();
    // El botón vuelve a estar disponible.
    expect(botonDe("2026-10-22", /Marcar referencia/)).toBeEnabled();
  });

  it("un 404 también se muestra con EstadoError", async () => {
    apiSimulada.desmarcarCorteReferencia.mockRejectedValue(
      new ErrorApi("No existe el corte.", {
        estado: 404,
        codigo: "recurso_no_encontrado",
      }),
    );
    const usuario = await abrirHistorico();

    await usuario.click(botonDe("2026-09-01", /Quitar referencia/));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No existe el corte.",
    );
  });

  it("el doble clic envía una sola petición y deshabilita los botones mientras procesa", async () => {
    let resolver;
    apiSimulada.marcarCorteReferencia.mockImplementation(
      () => new Promise((resolve) => (resolver = resolve)),
    );
    const usuario = await abrirHistorico();
    const boton = botonDe("2026-10-22", /Marcar referencia/);

    await usuario.dblClick(boton);

    expect(apiSimulada.marcarCorteReferencia).toHaveBeenCalledTimes(1);
    expect(boton).toBeDisabled();

    resolver({});
    await waitFor(() => expect(boton).toBeEnabled());
  });

  it("si la recarga posterior falla, no deja una lista vieja con posibles dos estrellas", async () => {
    apiSimulada.marcarCorteReferencia.mockResolvedValue({});
    const usuario = await abrirHistorico();
    apiSimulada.listarCortes.mockRejectedValue(
      new ErrorApi("No se pudo conectar con el servidor.", {
        codigo: "error_red",
      }),
    );

    await usuario.click(botonDe("2026-10-22", /Marcar referencia/));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el servidor.",
    );
    expect(screen.queryByText("2026-09-01")).not.toBeInTheDocument();
  });
});
