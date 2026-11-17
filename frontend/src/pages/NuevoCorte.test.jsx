/**
 * Pruebas de la pantalla de carga de un corte en BORRADOR: corregir
 * vigencia/fecha (PATCH) y descartar el borrador (DELETE).
 *
 * DECISIONES: D11 (un solo borrador a la vez) y D36 (descarte con borrado
 * físico). Seguimiento del PR #208, que llegó sin pruebas de esta pantalla.
 *
 * Se simula `api` y la autenticación; el router es real (`MemoryRouter`)
 * para comprobar la navegación tras descartar.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiSimulada, estadoAutenticacion } = vi.hoisted(() => ({
  apiSimulada: {
    obtenerCorte: vi.fn(),
    corregirCorte: vi.fn(),
    descartarCorte: vi.fn(),
  },
  estadoAutenticacion: { puedeEscribir: true },
}));

vi.mock("../api/cliente.js", () => ({
  api: apiSimulada,
  ErrorApi: class ErrorApi extends Error {
    constructor(mensaje, { estado, codigo, detalles } = {}) {
      super(mensaje);
      this.estado = estado;
      this.codigo = codigo;
      this.detalles = detalles ?? {};
    }
  },
}));
vi.mock("../auth/ProveedorAutenticacion.jsx", () => ({
  useAutenticacion: () => estadoAutenticacion,
}));

import { ErrorApi } from "../api/cliente.js";
import NuevoCorte from "./NuevoCorte.jsx";

const CORTE_ID = "11111111-1111-1111-1111-111111111111";

function corte(sobrescribir = {}) {
  return {
    id: CORTE_ID,
    vigencia: 2025,
    fecha_corte: "2025-06-30",
    estado: "BORRADOR",
    archivos: [{ tipo: "PDT", nombre_archivo: "pdt.xlsx", reutilizado: false }],
    ...sobrescribir,
  };
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={[`/cortes/${CORTE_ID}`]}>
      <Routes>
        <Route path="/cortes/:corteId" element={<NuevoCorte />} />
        <Route path="/cortes" element={<p>Histórico de cortes</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  estadoAutenticacion.puedeEscribir = true;
  apiSimulada.obtenerCorte.mockResolvedValue(corte());
});

describe("NuevoCorte - corte en BORRADOR", () => {
  it("ofrece corregir y descartar", async () => {
    renderizar();

    expect(
      await screen.findByRole("button", { name: "Corregir vigencia o fecha" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descartar borrador" }),
    ).toBeInTheDocument();
  });

  it("no ofrece corregir ni descartar si el corte ya está REGISTRADO", async () => {
    apiSimulada.obtenerCorte.mockResolvedValue(corte({ estado: "REGISTRADO" }));
    renderizar();

    await screen.findByText(/Corte de vigencia 2025/);
    expect(
      screen.queryByRole("button", { name: "Corregir vigencia o fecha" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Descartar borrador" }),
    ).not.toBeInTheDocument();
  });

  it("un rol de solo lectura no pide el corte ni ve las acciones", async () => {
    estadoAutenticacion.puedeEscribir = false;
    renderizar();

    expect(
      await screen.findByText(/No tiene permiso para crear ni continuar/),
    ).toBeInTheDocument();
    expect(apiSimulada.obtenerCorte).not.toHaveBeenCalled();
  });
});

describe("NuevoCorte - corregir vigencia o fecha", () => {
  it("envía la corrección, actualiza el encabezado y conserva los archivos", async () => {
    const usuario = userEvent.setup();
    apiSimulada.corregirCorte.mockResolvedValue({
      id: CORTE_ID,
      vigencia: 2026,
      fecha_corte: "2026-01-15",
      estado: "BORRADOR",
    });
    renderizar();

    await usuario.click(
      await screen.findByRole("button", { name: "Corregir vigencia o fecha" }),
    );
    const vigencia = screen.getByLabelText("Vigencia");
    expect(vigencia).toHaveValue(2025);
    await usuario.clear(vigencia);
    await usuario.type(vigencia, "2026");
    const fecha = screen.getByLabelText("Fecha del corte");
    await usuario.clear(fecha);
    await usuario.type(fecha, "2026-01-15");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(apiSimulada.corregirCorte).toHaveBeenCalledWith(
        CORTE_ID,
        2026,
        "2026-01-15",
      ),
    );
    expect(await screen.findByText(/Corte de vigencia 2026/)).toBeVisible();
    expect(screen.getByText("2026-01-15")).toBeVisible();
    // Los archivos ya cargados se conservan: el PATCH no los devuelve.
    expect(screen.getByText("Cargada en este corte")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Corregir vigencia o fecha" }),
    ).toBeInTheDocument();
  });

  it("muestra el error del backend y mantiene el formulario abierto", async () => {
    const usuario = userEvent.setup();
    apiSimulada.corregirCorte.mockRejectedValue(
      new ErrorApi("Ya existe un corte con esa vigencia y fecha.", {
        estado: 409,
        codigo: "regla_de_negocio_violada",
      }),
    );
    renderizar();

    await usuario.click(
      await screen.findByRole("button", { name: "Corregir vigencia o fecha" }),
    );
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText(/Ya existe un corte con esa vigencia y fecha/),
    ).toBeVisible();
    expect(screen.getByLabelText("Vigencia")).toBeInTheDocument();
    expect(screen.getByText(/Corte de vigencia 2025/)).toBeVisible();
  });

  it("cancelar cierra el formulario sin llamar a la API", async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(
      await screen.findByRole("button", { name: "Corregir vigencia o fecha" }),
    );
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(apiSimulada.corregirCorte).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Vigencia")).not.toBeInTheDocument();
  });
});

describe("NuevoCorte - descartar borrador", () => {
  it("pide confirmación y no borra si se cancela", async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(
      await screen.findByRole("button", { name: "Descartar borrador" }),
    );
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText(/no se puede deshacer/)).toBeVisible();
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Cancelar" }),
    );

    expect(apiSimulada.descartarCorte).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("al confirmar llama a DELETE y vuelve al histórico", async () => {
    const usuario = userEvent.setup();
    apiSimulada.descartarCorte.mockResolvedValue(null);
    renderizar();

    await usuario.click(
      await screen.findByRole("button", { name: "Descartar borrador" }),
    );
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Descartar",
      }),
    );

    await waitFor(() =>
      expect(apiSimulada.descartarCorte).toHaveBeenCalledWith(CORTE_ID),
    );
    expect(await screen.findByText("Histórico de cortes")).toBeVisible();
  });

  it("si el backend rechaza (409) muestra el error y se queda en la pantalla", async () => {
    const usuario = userEvent.setup();
    apiSimulada.descartarCorte.mockRejectedValue(
      new ErrorApi("Solo un corte en BORRADOR puede descartarse.", {
        estado: 409,
        codigo: "operacion_no_permitida",
        detalles: { motivo: "corte_no_es_borrador" },
      }),
    );
    renderizar();

    await usuario.click(
      await screen.findByRole("button", { name: "Descartar borrador" }),
    );
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Descartar",
      }),
    );

    expect(
      await screen.findByText(/Solo un corte en BORRADOR puede descartarse/),
    ).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Histórico de cortes")).not.toBeInTheDocument();
  });
});
