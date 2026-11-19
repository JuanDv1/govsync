/**
 * Pruebas de la pantalla del Plan de Acción con sesión (modo no público).
 *
 * TARJETAS: [E04-HU01] consulta, [E04-HU02] filtros y [E04-HU03] exportación.
 * El modo público lo cubre PlanAccionPublico.test.jsx.
 *
 * Se simula `api` (el backend tiene sus propias pruebas) y `guardarArchivo`
 * (jsdom no descarga archivos). `ErrorApi` y los filtros son los reales.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiSimulada, guardarArchivoSimulado } = vi.hoisted(() => ({
  apiSimulada: {
    planAccionActual: vi.fn(),
    exportarPlanAccion: vi.fn(),
    cortesDisponibles: vi.fn(),
  },
  guardarArchivoSimulado: vi.fn(),
}));

vi.mock("../api/cliente.js", async (importarOriginal) => ({
  ...(await importarOriginal()),
  api: apiSimulada,
}));
vi.mock("../lib/descarga.js", async (importarOriginal) => ({
  ...(await importarOriginal()),
  guardarArchivo: guardarArchivoSimulado,
}));

import { ErrorApi } from "../api/cliente.js";
import PlanAccion from "./PlanAccion.jsx";

function fila(sobreescribir) {
  return {
    sector: "Transporte",
    cod_indicador_producto: "040110500",
    nombre_producto: "Vías pavimentadas mantenidas",
    meta_programada: "10.00",
    cod_bpin: "2024190010001",
    rubros: ["2.3.2.02.02.009"],
    presupuesto_definitivo: "1000.00",
    ejecucion: "500.00",
    contratos: ["CT-001"],
    avance_fisico_pct: null,
    avance_financiero_pct: "50.00",
    estado_cruce: "completo",
    bpins: ["2024190010001"],
    desglose: [
      {
        codigo_rubro: "2.3.2.02.02.009",
        presupuesto_definitivo: "1000.00",
        ejecucion: "500.00",
        contratos: [{ numero_contrato: "CT-001" }],
      },
    ],
    ...sobreescribir,
  };
}

const PLAN = {
  corte_id: "c1",
  vigencia: 2026,
  fecha_corte: "2026-10-31",
  filas: [
    fila({}),
    fila({
      sector: "Educación",
      cod_indicador_producto: "220100100",
      nombre_producto: "Aulas dotadas",
      estado_cruce: "parcial",
    }),
  ],
  resumen: { total: 2, completo: 1, parcial: 1, sin_informacion: 0 },
};

function renderizar() {
  return render(
    <MemoryRouter>
      <PlanAccion />
    </MemoryRouter>,
  );
}

async function abrirPlan(plan = PLAN) {
  apiSimulada.planAccionActual.mockResolvedValue(plan);
  const usuario = userEvent.setup();
  renderizar();
  await screen.findByText("Aulas dotadas");
  return usuario;
}

beforeEach(() => {
  vi.resetAllMocks();
  apiSimulada.cortesDisponibles.mockResolvedValue([]);
});

describe("Plan de Acción con sesión", () => {
  it("[E04-HU01/CA01] muestra una fila por meta y el contador", async () => {
    await abrirPlan();

    expect(
      screen.getByText("Vías pavimentadas mantenidas"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mostrando 2 de 2 metas")).toBeInTheDocument();
    expect(
      screen.getByText(/Total: 2 \| Completo: 1 \| Parcial: 1/),
    ).toBeInTheDocument();
  });

  it("[E04-HU01] un corte sin metas muestra el estado vacío, sin tabla", async () => {
    apiSimulada.planAccionActual.mockResolvedValue({
      ...PLAN,
      filas: [],
      resumen: { total: 0, completo: 0, parcial: 0, sin_informacion: 0 },
    });

    renderizar();

    expect(
      await screen.findByText("El corte no tiene metas"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("[E04-HU01] una respuesta sin `filas` es un error con Reintentar que vuelve a pedir", async () => {
    apiSimulada.planAccionActual
      .mockResolvedValueOnce({ corte_id: "c1" })
      .mockResolvedValueOnce(PLAN);
    const usuario = userEvent.setup();

    renderizar();
    await usuario.click(
      await screen.findByRole("button", { name: /Reintentar/ }),
    );

    expect(await screen.findByText("Aulas dotadas")).toBeInTheDocument();
    expect(apiSimulada.planAccionActual).toHaveBeenCalledTimes(2);
  });

  it("[E04-HU01/CA03] 'Ver detalle' abre y cierra la subfila de la meta", async () => {
    const usuario = await abrirPlan();
    const boton = screen.getByRole("button", {
      name: /detalle de la meta 220100100/,
    });

    await usuario.click(boton);
    expect(
      screen.getByRole("button", {
        name: /Ocultar detalle de la meta 220100100/,
      }),
    ).toBeInTheDocument();

    await usuario.click(
      screen.getByRole("button", {
        name: /Ocultar detalle de la meta 220100100/,
      }),
    );
    expect(
      screen.getByRole("button", { name: /Ver detalle de la meta 220100100/ }),
    ).toBeInTheDocument();
  });

  it("[E04-HU02/CA07] un filtro sin coincidencias muestra el aviso y 'Limpiar filtros' restaura todo", async () => {
    const usuario = await abrirPlan();

    await usuario.click(screen.getByRole("button", { name: /^Filtros/ }));
    await usuario.click(
      screen.getByRole("checkbox", { name: "Sin información" }),
    );

    expect(
      await screen.findByText(
        "No hay metas que cumplan los filtros seleccionados",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Mostrando 0 de 2 metas")).toBeInTheDocument();

    await usuario.click(
      screen.getByRole("button", { name: "Limpiar filtros" }),
    );

    expect(screen.getByText("Mostrando 2 de 2 metas")).toBeInTheDocument();
    expect(
      screen.queryByText("No hay metas que cumplan los filtros seleccionados"),
    ).not.toBeInTheDocument();
  });

  it("[E04-HU02] el filtro por estado deja solo las metas de ese estado", async () => {
    const usuario = await abrirPlan();

    await usuario.click(screen.getByRole("button", { name: /^Filtros/ }));
    await usuario.click(screen.getByRole("checkbox", { name: "Parcial" }));

    expect(screen.getByText("Mostrando 1 de 2 metas")).toBeInTheDocument();
    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText("Aulas dotadas")).toBeInTheDocument();
    expect(
      within(tabla).queryByText("Vías pavimentadas mantenidas"),
    ).not.toBeInTheDocument();
  });

  it("[E04-HU03/CA01] 'Exportar a Excel' pide el archivo y avisa con el nombre", async () => {
    const blob = new Blob(["x"]);
    apiSimulada.exportarPlanAccion.mockResolvedValue({
      blob,
      nombre: "plan_accion_2026.xlsx",
    });
    const usuario = await abrirPlan();

    await usuario.click(
      screen.getByRole("button", { name: "Exportar a Excel" }),
    );

    expect(
      await screen.findByText("Descarga lista: plan_accion_2026.xlsx"),
    ).toBeInTheDocument();
    expect(guardarArchivoSimulado).toHaveBeenCalledWith(
      blob,
      "plan_accion_2026.xlsx",
    );
    expect(apiSimulada.exportarPlanAccion).toHaveBeenCalledTimes(1);
  });

  it("[E04-HU03/CA08] si la exportación falla muestra un error y no guarda nada", async () => {
    apiSimulada.exportarPlanAccion.mockRejectedValue(
      new ErrorApi("Falló.", { codigo: "error_interno", estado: 500 }),
    );
    const usuario = await abrirPlan();

    await usuario.click(
      screen.getByRole("button", { name: "Exportar a Excel" }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(guardarArchivoSimulado).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Exportar a Excel" }),
      ).not.toHaveAttribute("aria-busy", "true"),
    );
  });

  it("[E04-HU03/CA07] sin metas visibles el botón de exportar está deshabilitado", async () => {
    const usuario = await abrirPlan();

    await usuario.click(screen.getByRole("button", { name: /^Filtros/ }));
    await usuario.click(
      screen.getByRole("checkbox", { name: "Sin información" }),
    );

    expect(
      screen.getByRole("button", { name: "Exportar a Excel" }),
    ).toBeDisabled();
    expect(apiSimulada.exportarPlanAccion).not.toHaveBeenCalled();
  });
});
