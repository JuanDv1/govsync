/**
 * Pruebas de la pantalla de metas en riesgo.
 *
 * TARJETA: [E-04/HU-07] FE. Criterios: CA01/CA03 (lo decide el backend; aquí
 * se muestra lo que llega), CA04 (contador de metas sin presupuesto, que no se
 * listan), CA05 (orden del backend, sin reordenar), CA07 (vacío) y la decisión
 * del PO del 2026-11-11 ("Sin ejecución registrada" como texto, no solo color).
 *
 * Cliente HTTP real con `fetch` simulado. La pantalla no usa la sesión.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MetasEnRiesgo from "./MetasEnRiesgo.jsx";

const fetchSimulado = vi.fn();

function fila(sobreescribir) {
  return {
    sector: "Transporte",
    cod_indicador_producto: "040110500",
    nombre_producto: "Vías pavimentadas mantenidas",
    meta_programada: "10.00",
    cod_bpin: "2024190010001",
    rubros: ["2.3.2.02.02.009"],
    presupuesto_definitivo: "1000000.00",
    ejecucion: "200000.00",
    contratos: [],
    avance_fisico_pct: null,
    avance_financiero_pct: "20.00",
    estado_cruce: "completo",
    bpins: [],
    desglose: [],
    sin_ejecucion_registrada: false,
    ...sobreescribir,
  };
}

function respuesta(sobreescribir) {
  return {
    corte_id: "c1",
    vigencia: 2026,
    fecha_corte: "2026-10-22",
    umbral_pct: "50.00",
    filas: [],
    total_en_riesgo: 0,
    metas_sin_presupuesto: 0,
    ...sobreescribir,
  };
}

function responderJson(estado, cuerpo) {
  fetchSimulado.mockResolvedValueOnce(
    new Response(JSON.stringify(cuerpo), { status: estado }),
  );
}

function abrir() {
  return render(
    <MemoryRouter>
      <MetasEnRiesgo />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSimulado);
});

afterEach(() => {
  fetchSimulado.mockReset();
  vi.unstubAllGlobals();
});

describe("Metas en riesgo", () => {
  it("pide /plan-accion/riesgo y muestra el corte y el umbral que entrega el backend", async () => {
    responderJson(200, respuesta({ filas: [fila({})], total_en_riesgo: 1 }));

    abrir();

    expect(
      await screen.findByRole("heading", { name: "Metas en riesgo" }),
    ).toBeInTheDocument();
    expect(fetchSimulado.mock.calls[0][0]).toBe("/api/v1/plan-accion/riesgo");
    expect(
      screen.getByText(/menos del 50 % de avance financiero\. Corte/, {
        selector: "p",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("22/10/2026")).toBeInTheDocument();
  });

  it("CA05: conserva el orden del backend y muestra el % que calcula el backend", async () => {
    responderJson(
      200,
      respuesta({
        total_en_riesgo: 3,
        filas: [
          fila({
            cod_indicador_producto: "A-0",
            avance_financiero_pct: "0.00",
          }),
          fila({
            cod_indicador_producto: "B-12",
            avance_financiero_pct: "12.50",
          }),
          fila({
            cod_indicador_producto: "C-49",
            avance_financiero_pct: "49.90",
          }),
        ],
      }),
    );

    abrir();
    await screen.findByText("A-0");

    const cuerpo = screen.getAllByRole("rowgroup")[1];
    const filas = within(cuerpo).getAllByRole("row");
    expect(
      filas.map((f) => within(f).getAllByRole("cell")[0].textContent),
    ).toEqual([
      expect.stringContaining("A-0"),
      expect.stringContaining("B-12"),
      expect.stringContaining("C-49"),
    ]);
    expect(within(filas[0]).getByText("0,0%")).toBeInTheDocument();
    expect(within(filas[1]).getByText("12,5%")).toBeInTheDocument();
    expect(within(filas[2]).getByText("49,9%")).toBeInTheDocument();
  });

  it("marca con texto 'Sin ejecución registrada' solo la meta que el backend marca", async () => {
    responderJson(
      200,
      respuesta({
        total_en_riesgo: 2,
        filas: [
          fila({
            cod_indicador_producto: "SIN-DATO",
            ejecucion: null,
            avance_financiero_pct: "0.00",
            sin_ejecucion_registrada: true,
          }),
          fila({
            cod_indicador_producto: "CERO-REAL",
            ejecucion: "0.00",
            avance_financiero_pct: "0.00",
            sin_ejecucion_registrada: false,
          }),
        ],
      }),
    );

    abrir();
    await screen.findByText("SIN-DATO");

    expect(screen.getAllByText("Sin ejecución registrada")).toHaveLength(1);
    const filaMarcada = screen.getByText("SIN-DATO").closest("tr");
    expect(
      within(filaMarcada).getByText("Sin ejecución registrada"),
    ).toBeInTheDocument();
    const filaCero = screen.getByText("CERO-REAL").closest("tr");
    expect(
      within(filaCero).queryByText("Sin ejecución registrada"),
    ).not.toBeInTheDocument();
  });

  it("una celda sin dato muestra un guion, nunca 0", async () => {
    responderJson(
      200,
      respuesta({
        total_en_riesgo: 1,
        filas: [
          fila({
            cod_indicador_producto: "SIN-DATO",
            sector: null,
            ejecucion: null,
            sin_ejecucion_registrada: true,
            avance_financiero_pct: "0.00",
          }),
        ],
      }),
    );

    abrir();
    await screen.findByText("SIN-DATO");

    const celdas = within(
      screen.getByText("SIN-DATO").closest("tr"),
    ).getAllByRole("cell");
    expect(within(celdas[1]).getByLabelText("Sin dato")).toBeInTheDocument();
    expect(within(celdas[3]).getByLabelText("Sin dato")).toBeInTheDocument();
  });

  it("CA04: informa cuántas metas sin presupuesto no se listan", async () => {
    responderJson(
      200,
      respuesta({
        filas: [fila({})],
        total_en_riesgo: 1,
        metas_sin_presupuesto: 4,
      }),
    );

    abrir();

    expect(
      await screen.findByText(/sin presupuesto \(no se listan\)/),
    ).toHaveTextContent("1 meta en riesgo · 4 metas sin presupuesto");
  });

  it("CA07: sin metas en riesgo muestra el mensaje y no dibuja la tabla", async () => {
    responderJson(200, respuesta({}));

    abrir();

    expect(
      await screen.findByText("No hay metas en riesgo en este corte"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("404: aún no hay cortes finalizados", async () => {
    responderJson(404, { codigo: "recurso_no_encontrado", mensaje: "x" });

    abrir();

    expect(
      await screen.findByText("Aún no hay cortes finalizados para consultar"),
    ).toBeInTheDocument();
  });

  it("403: aviso de permiso, sin tabla", async () => {
    responderJson(403, { codigo: "permiso_insuficiente", mensaje: "x" });

    abrir();

    expect(
      await screen.findByText("No tiene permiso para ver las metas en riesgo"),
    ).toBeInTheDocument();
  });

  it("409: muestra el error con las fuentes que faltan y permite reintentar", async () => {
    responderJson(409, {
      codigo: "operacion_no_permitida",
      mensaje: "Al corte le falta una fuente.",
      detalles: { archivos_faltantes: ["BPIN"] },
    });
    responderJson(200, respuesta({}));

    abrir();

    expect(await screen.findByText(/Archivos faltantes: BPIN/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(
      await screen.findByText("No hay metas en riesgo en este corte"),
    ).toBeInTheDocument();
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it("una respuesta 200 que no es la esperada se trata como error, no como pantalla en blanco", async () => {
    responderJson(200, { algo: "distinto" });

    abrir();

    expect(
      await screen.findByRole("button", { name: /Reintentar/ }),
    ).toBeInTheDocument();
  });
});
