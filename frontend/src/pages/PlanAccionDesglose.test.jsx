/**
 * Pruebas del desglose del detalle de una meta (E04-HU01-CA03), en modo con
 * sesión y en modo público. Se simula `api`; el backend tiene sus pruebas.
 *
 * Reglas que fijan: el contrato muestra número, objeto, valor y valor pagado;
 * en modo público solo el número; `null` es "—"; un contrato en dos rubros sale
 * bajo cada uno; la pantalla no suma valores de contrato (los totales son los
 * del backend, que son la suma de los rubros).
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiSimulada } = vi.hoisted(() => ({
  apiSimulada: {
    planAccionActual: vi.fn(),
    planAccionPublicoActual: vi.fn(),
    cortesDisponibles: vi.fn(),
  },
}));

vi.mock("../api/cliente.js", async (importarOriginal) => ({
  ...(await importarOriginal()),
  api: apiSimulada,
}));

import { cop } from "../lib/formato.js";
import { fila } from "../test/fixturesPlanAccion.js";
import PlanAccion from "./PlanAccion.jsx";

const CODIGO_META = "040110500";
const NOMBRE_META = "Vías pavimentadas mantenidas";

function contrato(numero, sobreescribir) {
  return {
    numero_contrato: numero,
    objeto: `Objeto de ${numero}`,
    valor: "300.00",
    valor_pagado: "120.00",
    ...sobreescribir,
  };
}

function rubro(codigo, contratos, sobreescribir) {
  return {
    codigo_rubro: codigo,
    presupuesto_definitivo: "1000.00",
    ejecucion: "500.00",
    contratos,
    ...sobreescribir,
  };
}

function plan(filaMeta) {
  return {
    corte_id: "c1",
    vigencia: 2026,
    fecha_corte: "2026-10-31",
    filas: [filaMeta],
    resumen: { total: 1, completo: 1, parcial: 0, sin_informacion: 0 },
  };
}

// Fila coherente con su desglose: totales = suma de los rubros.
function filaDe(desglose, sobreescribir) {
  const suma = (campo) =>
    desglose.reduce((total, r) => total + Number(r[campo]), 0).toFixed(2);
  return fila({
    desglose,
    rubros: desglose.map((r) => r.codigo_rubro),
    contratos: [
      ...new Set(
        desglose.flatMap((r) => r.contratos.map((c) => c.numero_contrato)),
      ),
    ],
    presupuesto_definitivo: suma("presupuesto_definitivo"),
    ejecucion: suma("ejecucion"),
    ...sobreescribir,
  });
}

async function abrirDetalle({ publico = false, ...filaMeta }) {
  const respuesta = plan(filaMeta.fila);
  apiSimulada.planAccionActual.mockResolvedValue(respuesta);
  apiSimulada.planAccionPublicoActual.mockResolvedValue(respuesta);
  const usuario = userEvent.setup();
  render(
    <MemoryRouter>
      <PlanAccion publico={publico} />
    </MemoryRouter>,
  );
  await screen.findByText(NOMBRE_META);
  await usuario.click(
    screen.getByRole("button", {
      name: `Ver detalle de la meta ${CODIGO_META}`,
    }),
  );
  return {
    usuario,
    detalle: document.getElementById(`detalle-${CODIGO_META}`),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  apiSimulada.cortesDisponibles.mockResolvedValue([]);
});

describe("Desglose por rubro y contrato (con sesión)", () => {
  it("[E04-HU01/CA03] muestra el rubro con sus montos y el contrato con todos sus campos", async () => {
    const { detalle } = await abrirDetalle({
      fila: filaDe([rubro("2.3.2.02.02.009", [contrato("CT-001")])]),
    });

    const rubros = document.getElementById(`rubros-${CODIGO_META}`);
    expect(within(rubros).getByText("2.3.2.02.02.009")).toBeInTheDocument();
    expect(
      within(rubros).getByText("Presupuesto definitivo:"),
    ).toBeInTheDocument();
    // Un rubro con montos 1000 / 500 y un contrato con 300 / 120.
    expect(within(rubros).getByText(cop(1000))).toBeInTheDocument();
    expect(within(rubros).getByText(cop(500))).toBeInTheDocument();
    expect(within(rubros).getByText("CT-001")).toBeInTheDocument();
    expect(within(rubros).getByText("Objeto de CT-001")).toBeInTheDocument();
    expect(within(rubros).getByText(cop(300))).toBeInTheDocument();
    expect(within(rubros).getByText(cop(120))).toBeInTheDocument();
    expect(detalle).not.toHaveTextContent(/más adelante/i);
    expect(detalle).not.toHaveTextContent(/undefined/);
  });

  it("[E04-HU01/CA03] un rubro sin contratos lo dice y no rompe el resto", async () => {
    const { detalle } = await abrirDetalle({
      fila: filaDe([rubro("2.1.1", []), rubro("2.1.2", [contrato("CT-009")])]),
    });

    expect(within(detalle).getByText("Sin contratos")).toBeInTheDocument();
    expect(within(detalle).getByText("CT-009")).toBeInTheDocument();
    expect(within(detalle).getByText("Rubros (2)")).toBeInTheDocument();
  });

  it("[E04-HU01/CA03] un mismo contrato bajo dos rubros sale en ambos y no se suma en ningún total", async () => {
    // Contrato de 300 bajo dos rubros: si la pantalla sumara contratos
    // aparecería $ 600 en algún lado. Los totales son los del backend.
    const { detalle } = await abrirDetalle({
      fila: filaDe([
        rubro("2.1.1", [contrato("CT-001")]),
        rubro("2.1.2", [contrato("CT-001")]),
      ]),
    });

    expect(within(detalle).getAllByText("CT-001")).toHaveLength(2);
    expect(within(detalle).getAllByText(cop(300))).toHaveLength(2);
    expect(detalle).not.toHaveTextContent(cop(600));
    // Totales de la meta: suma de los rubros (1000 + 1000, 500 + 500).
    expect(detalle).toHaveTextContent(cop(2000));
    expect(detalle).toHaveTextContent(cop(1000));
    expect(
      within(detalle).getByText(/Los valores de los contratos no se suman/),
    ).toBeInTheDocument();
  });

  it("[E04-HU01/CA03] los totales de la meta coinciden con la suma de los rubros del desglose", async () => {
    const desglose = [
      rubro("2.1.1", [contrato("CT-001")], {
        presupuesto_definitivo: "700.00",
        ejecucion: "100.00",
      }),
      rubro("2.1.2", [contrato("CT-002")], {
        presupuesto_definitivo: "300.00",
        ejecucion: "250.00",
      }),
    ];
    const filaMeta = filaDe(desglose);
    const { detalle } = await abrirDetalle({ fila: filaMeta });

    const suma = (campo) =>
      desglose.reduce((total, r) => total + Number(r[campo]), 0);
    expect(Number(filaMeta.presupuesto_definitivo)).toBe(
      suma("presupuesto_definitivo"),
    );
    expect(Number(filaMeta.ejecucion)).toBe(suma("ejecucion"));
    expect(detalle).toHaveTextContent(cop(suma("presupuesto_definitivo")));
    expect(detalle).toHaveTextContent(cop(suma("ejecucion")));
  });

  it("[E04-HU01/CA03] objeto, valor y valor pagado en null se muestran como '—'", async () => {
    const { detalle } = await abrirDetalle({
      fila: filaDe([
        rubro(
          "2.1.1",
          [
            contrato("CT-001", {
              objeto: null,
              valor: null,
              valor_pagado: null,
            }),
          ],
          { presupuesto_definitivo: null, ejecucion: null },
        ),
      ]),
    });

    const rubros = document.getElementById(`rubros-${CODIGO_META}`);
    // objeto + valor + valor pagado + presupuesto + ejecución del rubro.
    expect(within(rubros).getAllByText("—")).toHaveLength(5);
    expect(detalle).not.toHaveTextContent(/null|undefined|NaN/);
  });

  it("[E04-HU01/CA03] una meta con muchos rubros muestra 5 y 'Ver los N rubros' despliega el resto", async () => {
    const muchos = Array.from({ length: 8 }, (_, i) =>
      rubro(`2.3.2.02.02.009.${String(i).padStart(3, "0")}`, [
        contrato(`CT-${i}`),
      ]),
    );
    const { usuario } = await abrirDetalle({ fila: filaDe(muchos) });
    const lista = document.getElementById(`rubros-${CODIGO_META}`);

    expect(within(lista).getAllByText(/^2\.3\.2\.02\.02\.009\./)).toHaveLength(
      5,
    );
    const boton = screen.getByRole("button", { name: "Ver los 8 rubros" });
    expect(boton).toHaveAttribute("aria-expanded", "false");

    await usuario.click(boton);

    expect(within(lista).getAllByText(/^2\.3\.2\.02\.02\.009\./)).toHaveLength(
      8,
    );
    expect(screen.getByRole("button", { name: "Ver menos" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("[E04-HU01/CA03] un rubro con muchos contratos usa 'Ver los N contratos'", async () => {
    const contratos = Array.from({ length: 7 }, (_, i) => contrato(`CT-${i}`));
    const { usuario } = await abrirDetalle({
      fila: filaDe([rubro("2.1.1", contratos)]),
    });

    expect(screen.queryByText("CT-6")).not.toBeInTheDocument();
    await usuario.click(
      screen.getByRole("button", { name: "Ver los 7 contratos" }),
    );
    expect(screen.getByText("CT-6")).toBeInTheDocument();
  });

  it("[E04-HU01/CA03] un código de rubro de ~70 caracteres se muestra completo", async () => {
    const largo = `2.3.2.02.02.009.${"1234567890.".repeat(5)}9999`;
    const { detalle } = await abrirDetalle({
      fila: filaDe([rubro(largo, [])]),
    });

    expect(within(detalle).getByText(largo)).toBeInTheDocument();
  });
});

describe("BPIN del detalle", () => {
  it("[E04-HU01/CA03] lista todos los BPIN de la meta", async () => {
    const { detalle } = await abrirDetalle({
      fila: filaDe([rubro("2.1.1", [])], {
        bpins: ["2024190010001", "2024190010002"],
      }),
    });

    expect(detalle).toHaveTextContent("BPIN: 2024190010001, 2024190010002");
  });

  it("[E04-HU01/CA03] sin BPIN dice 'Sin BPIN'", async () => {
    const { detalle } = await abrirDetalle({
      fila: filaDe([rubro("2.1.1", [])], { bpins: [], cod_bpin: null }),
    });

    expect(within(detalle).getByText("Sin BPIN")).toBeInTheDocument();
  });

  it("[E04-HU01/CA03] si `bpins` no llega usa `cod_bpin` de respaldo", async () => {
    const { detalle } = await abrirDetalle({
      fila: filaDe([rubro("2.1.1", [])], {
        bpins: undefined,
        cod_bpin: "2024190010009",
      }),
    });

    expect(detalle).toHaveTextContent("BPIN 2024190010009");
  });
});

describe("Desglose en modo público", () => {
  it("[E04-HU01/CA03] el contrato solo trae el número y no se pintan etiquetas ni columnas vacías", async () => {
    const { detalle } = await abrirDetalle({
      publico: true,
      fila: filaDe([
        rubro("2.1.1", [{ numero_contrato: "CT-001" }]),
        rubro("2.1.2", [{ numero_contrato: "CT-002" }]),
      ]),
    });

    expect(apiSimulada.planAccionPublicoActual).toHaveBeenCalled();
    expect(within(detalle).getByText("CT-001")).toBeInTheDocument();
    expect(within(detalle).getByText("CT-002")).toBeInTheDocument();
    // Los montos por rubro sí son públicos.
    expect(detalle).toHaveTextContent(cop(1000));
    expect(within(detalle).queryByText("Valor:")).not.toBeInTheDocument();
    expect(
      within(detalle).queryByText("Valor pagado:"),
    ).not.toBeInTheDocument();
    expect(detalle).not.toHaveTextContent(/objeto/i);
    expect(detalle).not.toHaveTextContent(/undefined|null|NaN/);
    expect(within(detalle).queryByText("—")).not.toBeInTheDocument();
  });
});
