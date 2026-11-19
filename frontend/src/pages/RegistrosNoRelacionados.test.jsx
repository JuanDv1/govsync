/**
 * Pruebas de la pantalla de registros no relacionados.
 *
 * TARJETA: [E-04/HU-05] FE. Criterios: CA01/CA02 (tabla del corte con Fuente,
 * Código, Descripción, Valor y Motivo), CA03 (etiquetas que entrega el
 * backend), CA04 (filtros Fuente y Motivo), CA05 (total y conteos del backend),
 * CA06 (vacío), CA07 (exportar con los filtros vigentes).
 *
 * Cliente HTTP real con `fetch` simulado por URL; la pantalla no usa la sesión.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegistrosNoRelacionados from "./RegistrosNoRelacionados.jsx";

const guardarArchivo = vi.hoisted(() => vi.fn());
vi.mock("../lib/descarga.js", async (importar) => ({
  ...(await importar()),
  guardarArchivo,
}));

const CORTE = "11111111-1111-1111-1111-111111111111";
const OPCIONES = {
  fuentes: [
    { valor: "PLAN_INDICATIVO", etiqueta: "Plan Indicativo" },
    { valor: "PRESUPUESTAL", etiqueta: "Ejecución presupuestal" },
    { valor: "BPIN", etiqueta: "Proyectos BPIN" },
  ],
  motivos: [
    { valor: "meta_sin_proyecto", etiqueta: "Meta sin proyecto BPIN" },
    { valor: "meta_sin_contrato", etiqueta: "Meta sin contrato" },
  ],
};

function registro(sobreescribir) {
  return {
    fuente: "PLAN_INDICATIVO",
    fuente_etiqueta: "Plan Indicativo",
    codigo: "040110500",
    descripcion: "Sedes dotadas",
    valor: null,
    motivo: "meta_sin_proyecto",
    motivo_etiqueta: "Meta sin proyecto BPIN",
    ...sobreescribir,
  };
}

function pagina(sobreescribir) {
  return {
    corte_id: CORTE,
    vigencia: 2026,
    fecha_corte: "2026-10-22",
    total: 2,
    conteos_por_fuente: { PLAN_INDICATIVO: 1, PRESUPUESTAL: 1, BPIN: 0 },
    pagina: 1,
    tamano_pagina: 50,
    filas: [
      registro({}),
      registro({
        fuente: "PRESUPUESTAL",
        fuente_etiqueta: "Ejecución presupuestal",
        codigo: "R-1",
        descripcion: "Rubro de prueba",
        valor: "1500000.00",
        motivo: "meta_sin_contrato",
        motivo_etiqueta: "Meta sin contrato",
      }),
    ],
    ...sobreescribir,
  };
}

const fetchSimulado = vi.fn();

/** Responde por ruta; `registros` puede ser una función de la URL. */
function simular({ registros, cortes, exportar } = {}) {
  fetchSimulado.mockImplementation(async (url) => {
    const json = (estado, cuerpo) =>
      new Response(JSON.stringify(cuerpo), { status: estado });
    if (url.includes("/opciones-filtro")) return json(200, OPCIONES);
    if (url.includes("/exportar")) {
      return (
        exportar?.(url) ??
        new Response(new Blob(["x"]), {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="no-relacionados.xlsx"',
          },
        })
      );
    }
    if (url.startsWith("/api/v1/registros-no-relacionados/")) {
      const r = typeof registros === "function" ? registros(url) : registros;
      return r ?? json(200, pagina());
    }
    if (url === "/api/v1/cortes") {
      return typeof cortes === "function" ? cortes() : json(200, cortes ?? []);
    }
    throw new Error(`URL no simulada: ${url}`);
  });
}

function abrir(ruta = `/registros-no-relacionados/${CORTE}`) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route
          path="/registros-no-relacionados/:corteId?"
          element={<RegistrosNoRelacionados />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const urlsPedidas = () => fetchSimulado.mock.calls.map(([url]) => url);

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSimulado);
});

afterEach(() => {
  fetchSimulado.mockReset();
  guardarArchivo.mockReset();
  vi.unstubAllGlobals();
});

describe("Registros no relacionados", () => {
  it("CA01/CA02/CA03: tabla con las etiquetas del backend; el valor solo donde aplica", async () => {
    simular();

    abrir();

    expect(await screen.findByText("Sedes dotadas")).toBeInTheDocument();
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas).toHaveLength(2);
    // Meta: sin valor (celda vacía, nunca "0"). Código con cero a la izquierda.
    expect(within(filas[0]).getByText("040110500")).toBeInTheDocument();
    expect(within(filas[0]).getByText("Meta sin proyecto BPIN")).toBeVisible();
    expect(within(filas[0]).queryByText(/\$/)).not.toBeInTheDocument();
    expect(within(filas[0]).queryByText("0")).not.toBeInTheDocument();
    // Rubro: con valor en pesos.
    expect(within(filas[1]).getByText("$ 1.500.000")).toBeInTheDocument();
    expect(within(filas[1]).getByText("Ejecución presupuestal")).toBeVisible();
    expect(screen.getByText("22/10/2026")).toBeInTheDocument();
  });

  it("CA05: el contador muestra el total y los conteos por fuente que entrega el backend", async () => {
    simular();

    abrir();

    const contador = await screen.findByText(
      /registros no relacionados$|registros no relacionados ·/,
    );
    expect(contador).toHaveTextContent(
      "2 registros no relacionados · Plan Indicativo: 1 · Ejecución presupuestal: 1 · Proyectos BPIN: 0",
    );
  });

  it("pide el corte de la URL con página 1 y 50 por página", async () => {
    simular();

    abrir();
    await screen.findByText("Sedes dotadas");

    const url = urlsPedidas().find((u) =>
      u.startsWith(`/api/v1/registros-no-relacionados/${CORTE}?`),
    );
    expect(url).toContain("pagina=1");
    expect(url).toContain("tamano_pagina=50");
    expect(url).not.toContain("fuente=");
  });

  it("CA04: filtrar por fuente pide el backend con el filtro, vuelve a la página 1 y muestra la etiqueta activa", async () => {
    simular({
      registros: (url) =>
        new Response(
          JSON.stringify(
            url.includes("fuente=BPIN")
              ? pagina({
                  total: 0,
                  filas: [],
                  conteos_por_fuente: {
                    PLAN_INDICATIVO: 0,
                    PRESUPUESTAL: 0,
                    BPIN: 0,
                  },
                })
              : pagina(),
          ),
          { status: 200 },
        ),
    });
    const usuario = userEvent.setup();

    abrir();
    await screen.findByText("Sedes dotadas");
    await usuario.click(screen.getByRole("combobox", { name: "Fuente" }));
    await usuario.click(
      await screen.findByRole("option", { name: "Proyectos BPIN" }),
    );

    expect(
      await screen.findByText("Ningún registro coincide con los filtros"),
    ).toBeInTheDocument();
    const ultima = urlsPedidas()
      .filter((u) => u.includes("fuente=BPIN"))
      .at(-1);
    expect(ultima).toContain("pagina=1");
    expect(ultima).not.toContain("motivo=");
    expect(
      screen.getByRole("button", {
        name: "Quitar filtro Fuente Proyectos BPIN",
      }),
    ).toBeInTheDocument();

    // Quitar la etiqueta restaura el listado.
    await usuario.click(
      screen.getByRole("button", {
        name: "Quitar filtro Fuente Proyectos BPIN",
      }),
    );
    expect(await screen.findByText("Sedes dotadas")).toBeInTheDocument();
  });

  it("CA04: fuente y motivo viajan como parámetros repetidos (AND entre criterios)", async () => {
    simular();
    const usuario = userEvent.setup();

    abrir();
    await screen.findByText("Sedes dotadas");
    await usuario.click(screen.getByRole("combobox", { name: "Fuente" }));
    await usuario.click(
      await screen.findByRole("option", { name: "Plan Indicativo" }),
    );
    await usuario.click(screen.getByRole("combobox", { name: "Motivo" }));
    await usuario.click(
      await screen.findByRole("option", { name: "Meta sin contrato" }),
    );

    await waitFor(() => {
      const ultima = urlsPedidas()
        .filter((u) => u.includes("motivo="))
        .at(-1);
      expect(ultima).toContain("fuente=PLAN_INDICATIVO");
      expect(ultima).toContain("motivo=meta_sin_contrato");
    });
  });

  it("CA06: sin registros no relacionados muestra el mensaje de éxito y no la tabla", async () => {
    simular({
      registros: () =>
        new Response(
          JSON.stringify(
            pagina({
              total: 0,
              filas: [],
              conteos_por_fuente: {
                PLAN_INDICATIVO: 0,
                PRESUPUESTAL: 0,
                BPIN: 0,
              },
            }),
          ),
          { status: 200 },
        ),
    });

    abrir();

    expect(
      await screen.findByText(
        "Todos los registros se relacionaron correctamente",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("pagina del lado del servidor: Siguiente pide la página 2", async () => {
    simular({
      registros: (url) =>
        new Response(
          JSON.stringify(
            url.includes("pagina=2")
              ? pagina({
                  total: 120,
                  pagina: 2,
                  filas: [
                    registro({ codigo: "PAG-2", descripcion: "Segunda" }),
                  ],
                })
              : pagina({ total: 120 }),
          ),
          { status: 200 },
        ),
    });
    const usuario = userEvent.setup();

    abrir();
    await screen.findByText("Página 1 de 3");
    await usuario.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("Segunda")).toBeInTheDocument();
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("CA07: exportar pide el Excel con los filtros vigentes y guarda el archivo", async () => {
    simular();
    const usuario = userEvent.setup();

    abrir();
    await screen.findByText("Sedes dotadas");
    await usuario.click(screen.getByRole("combobox", { name: "Motivo" }));
    await usuario.click(
      await screen.findByRole("option", { name: "Meta sin contrato" }),
    );
    await waitFor(() =>
      expect(
        urlsPedidas().some((u) => u.includes("motivo=meta_sin_contrato")),
      ).toBe(true),
    );
    await usuario.click(screen.getByRole("button", { name: /Exportar/ }));

    await waitFor(() => expect(guardarArchivo).toHaveBeenCalledTimes(1));
    const exportacion = urlsPedidas().find((u) => u.includes("/exportar"));
    expect(exportacion).toContain(
      `/api/v1/registros-no-relacionados/${CORTE}/exportar`,
    );
    expect(exportacion).toContain("motivo=meta_sin_contrato");
    expect(exportacion).not.toContain("pagina=");
  });

  it("sin registros, exportar queda deshabilitado", async () => {
    simular({
      registros: () =>
        new Response(
          JSON.stringify(
            pagina({
              total: 0,
              filas: [],
              conteos_por_fuente: {
                PLAN_INDICATIVO: 0,
                PRESUPUESTAL: 0,
                BPIN: 0,
              },
            }),
          ),
          { status: 200 },
        ),
    });

    abrir();
    await screen.findByText(
      "Todos los registros se relacionaron correctamente",
    );

    expect(screen.getByRole("button", { name: /Exportar/ })).toBeDisabled();
  });

  it("409: muestra las fuentes que faltan y permite reintentar", async () => {
    let intentos = 0;
    simular({
      registros: () =>
        new Response(
          JSON.stringify(
            intentos++ === 0
              ? {
                  codigo: "operacion_no_permitida",
                  mensaje: "Falta una fuente.",
                  detalles: { archivos_faltantes: ["BPIN"] },
                }
              : pagina(),
          ),
          { status: intentos === 1 ? 409 : 200 },
        ),
    });
    const usuario = userEvent.setup();

    abrir();

    expect(await screen.findByText(/Archivos faltantes: BPIN/)).toBeVisible();
    await usuario.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText("Sedes dotadas")).toBeInTheDocument();
  });

  it("403: aviso de permiso, sin tabla", async () => {
    simular({
      registros: () =>
        new Response(
          JSON.stringify({ codigo: "permiso_insuficiente", mensaje: "x" }),
          { status: 403 },
        ),
    });

    abrir();

    expect(
      await screen.findByText(
        "No tiene permiso para ver los registros no relacionados",
      ),
    ).toBeInTheDocument();
  });

  it("una respuesta 200 que no es la esperada se trata como error", async () => {
    simular({
      registros: () =>
        new Response(JSON.stringify({ algo: 1 }), { status: 200 }),
    });

    abrir();

    expect(
      await screen.findByRole("button", { name: /Reintentar/ }),
    ).toBeInTheDocument();
  });

  it("sin corteId usa el corte actual (el REGISTRADO más reciente)", async () => {
    simular({
      cortes: [
        { id: "borrador-1", estado: "BORRADOR", es_corte_actual: false },
        { id: CORTE, estado: "REGISTRADO", es_corte_actual: true },
        { id: "viejo-1", estado: "REGISTRADO", es_corte_actual: false },
      ],
    });

    abrir("/registros-no-relacionados");

    expect(await screen.findByText("Sedes dotadas")).toBeInTheDocument();
    expect(
      urlsPedidas().some((u) =>
        u.startsWith(`/api/v1/registros-no-relacionados/${CORTE}?`),
      ),
    ).toBe(true);
    expect(
      urlsPedidas().some(
        (u) => u.includes("borrador-1") || u.includes("viejo-1"),
      ),
    ).toBe(false);
  });

  it("si falla la búsqueda del corte actual, Reintentar vuelve a pedir GET /cortes", async () => {
    let llamadas = 0;
    simular({
      cortes: () => {
        llamadas += 1;
        return llamadas === 1
          ? new Response(
              JSON.stringify({ codigo: "error_interno", mensaje: "Falló." }),
              { status: 500 },
            )
          : new Response(
              JSON.stringify([
                { id: CORTE, estado: "REGISTRADO", es_corte_actual: true },
              ]),
              { status: 200 },
            );
      },
    });
    const usuario = userEvent.setup();

    abrir("/registros-no-relacionados");
    await usuario.click(
      await screen.findByRole("button", { name: /Reintentar/ }),
    );

    expect(await screen.findByText("Sedes dotadas")).toBeInTheDocument();
    expect(urlsPedidas().filter((u) => u === "/api/v1/cortes")).toHaveLength(2);
  });

  it("sin corte registrado muestra el aviso y no consulta registros", async () => {
    simular({
      cortes: [{ id: "b", estado: "BORRADOR", es_corte_actual: false }],
    });

    abrir("/registros-no-relacionados");

    expect(
      await screen.findByText("Aún no hay cortes finalizados para consultar"),
    ).toBeInTheDocument();
    expect(
      urlsPedidas().some((u) =>
        u.startsWith("/api/v1/registros-no-relacionados/"),
      ),
    ).toBe(false);
  });
});
