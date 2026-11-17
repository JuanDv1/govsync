/**
 * Pruebas de la consulta pública del Plan de Acción.
 *
 * TARJETA: [E-01/HU-01] FE - Acceso como visitante sin credenciales
 * DECISIONES DEL PO (2026-11-16): ruta fuera de `RutaProtegida`, sin
 * `Authorization`, sin exportar ni comparar, mismos filtros, detalle solo con
 * lo que trae el DTO público, errores 404/409/429.
 *
 * Se usa el cliente HTTP real con `fetch` simulado (contrato del DTO público
 * = `/plan-accion/actual` sin `objeto`, `valor` ni `valor_pagado` en el
 * `desglose`). NO se monta `ProveedorAutenticacion`: la pantalla debe
 * funcionar sin sesión, y `useAutenticacion` lanzaría si la usara.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { establecerProveedorToken } from "../api/cliente.js";
import App from "../App.jsx";

const fetchSimulado = vi.fn();

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

function responderJson(estado, cuerpo) {
  fetchSimulado.mockResolvedValueOnce(
    new Response(JSON.stringify(cuerpo), { status: estado }),
  );
}

function abrir() {
  return render(
    <MemoryRouter initialEntries={["/publico/plan-accion"]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSimulado);
  // Hay un token disponible: aun así la consulta pública no debe usarlo.
  establecerProveedorToken(() => "token-secreto");
});

afterEach(() => {
  fetchSimulado.mockReset();
  vi.unstubAllGlobals();
  establecerProveedorToken(() => null);
});

describe("Consulta pública del Plan de Acción", () => {
  it("se abre sin sesión, pide solo el endpoint público y no manda Authorization", async () => {
    responderJson(200, PLAN);

    abrir();

    expect(await screen.findByText("Aulas dotadas")).toBeInTheDocument();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchSimulado.mock.calls[0];
    expect(url.endsWith("/api/v1/publico/plan-accion/actual")).toBe(true);
    expect(opciones.headers).not.toHaveProperty("Authorization");
  });

  it("no tiene menú de módulos y ofrece 'Iniciar sesión' hacia /login", async () => {
    responderJson(200, PLAN);

    abrir();
    await screen.findByText("Aulas dotadas");

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/login");
  });

  it("no ofrece exportar ni comparar, ni consulta cortes disponibles", async () => {
    responderJson(200, PLAN);

    abrir();
    await screen.findByText("Aulas dotadas");

    expect(
      screen.queryByRole("button", { name: /exportar/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/comparar/i)).not.toBeInTheDocument();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    for (const [url] of fetchSimulado.mock.calls) {
      expect(url).toContain("/publico/");
    }
  });

  it("muestra 'Cargando' mientras llega la respuesta", () => {
    fetchSimulado.mockReturnValueOnce(new Promise(() => {}));

    abrir();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando el Plan de Acción",
    );
  });

  it("los filtros funcionan en el navegador, sin pedir nada más", async () => {
    responderJson(200, PLAN);
    const usuario = userEvent.setup();

    abrir();
    await screen.findByText("Aulas dotadas");
    expect(screen.getByText(/Mostrando 2 de 2 metas/)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /^Filtros/ }));
    const panel = screen.getByRole("region", {
      name: "Filtros del Plan de Acción",
    });
    await usuario.click(within(panel).getByLabelText("Parcial"));

    expect(screen.getByText(/Mostrando 1 de 2 metas/)).toBeInTheDocument();
    expect(screen.getByText("Aulas dotadas")).toBeInTheDocument();
    expect(
      screen.queryByText("Vías pavimentadas mantenidas"),
    ).not.toBeInTheDocument();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it("el detalle muestra rubros y contratos, sin objeto, valores ni el aviso de 'más adelante'", async () => {
    responderJson(200, PLAN);
    const usuario = userEvent.setup();

    abrir();
    await usuario.click(
      await screen.findByRole("button", {
        name: "Ver detalle de la meta 040110500",
      }),
    );

    const detalle = document.getElementById("detalle-040110500");
    expect(within(detalle).getByText("CT-001")).toBeInTheDocument();
    expect(within(detalle).getByText("2.3.2.02.02.009")).toBeInTheDocument();
    expect(detalle).not.toHaveTextContent(/más adelante/i);
    expect(detalle).not.toHaveTextContent(/objeto/i);
  });

  it("conserva el cero a la izquierda del código (texto, no número)", async () => {
    responderJson(200, PLAN);
    const usuario = userEvent.setup();

    abrir();
    await screen.findByText("Aulas dotadas");
    await usuario.click(screen.getByRole("button", { name: /^Filtros/ }));
    await usuario.type(screen.getByLabelText("Meta"), "040110");

    expect(screen.getByText(/Mostrando 1 de 2 metas/)).toBeInTheDocument();
    expect(screen.getByText("040110500")).toBeInTheDocument();
  });

  it("sin metas muestra el estado vacío", async () => {
    responderJson(200, { ...PLAN, filas: [] });

    abrir();

    expect(await screen.findByText("El corte no tiene metas")).toBeVisible();
  });
});

describe("Errores de la consulta pública", () => {
  it("404: avisa que aún no hay cortes finalizados", async () => {
    responderJson(404, { codigo: "recurso_no_encontrado", mensaje: "x" });

    abrir();

    expect(
      await screen.findByText("Aún no hay cortes finalizados para consultar"),
    ).toBeVisible();
  });

  it("409: mensaje fijo y NO expone los archivos que faltan", async () => {
    responderJson(409, {
      codigo: "operacion_no_permitida",
      mensaje: "Falta la fuente interna",
      detalles: { archivos_faltantes: ["ejecucion_presupuestal.xlsx"] },
    });

    abrir();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "El Plan de Acción todavía no está disponible",
    );
    expect(alerta).not.toHaveTextContent("ejecucion_presupuestal");
    expect(alerta).not.toHaveTextContent("Falta la fuente interna");
    expect(alerta).not.toHaveTextContent(/cargue/i);
  });

  it("429: 'Demasiadas consultas' con texto, y Reintentar vuelve a pedir", async () => {
    responderJson(429, { detail: "Rate limit exceeded" });
    responderJson(200, PLAN);
    const usuario = userEvent.setup();

    abrir();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "Demasiadas consultas, intente en un momento",
    );

    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Aulas dotadas")).toBeInTheDocument();
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it("otro error (500): no muestra los detalles internos", async () => {
    responderJson(500, {
      codigo: "error_interno",
      mensaje: "Fallo del servidor",
      detalles: { archivos_faltantes: ["secreto.xlsx"] },
    });

    abrir();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No se pudo cargar el Plan de Acción");
    expect(alerta).not.toHaveTextContent("Fallo del servidor");
    expect(alerta).not.toHaveTextContent("error_interno");
    expect(alerta).not.toHaveTextContent("secreto.xlsx");
  });

  it.each([
    [
      "401",
      401,
      { codigo: "credenciales_invalidas", mensaje: "Token requerido" },
    ],
    [
      "403",
      403,
      { codigo: "permiso_insuficiente", mensaje: "Rol no permitido" },
    ],
  ])(
    "%s inesperado: texto fijo, sin jerga de autenticación del backend",
    async (_nombre, estado, cuerpo) => {
      responderJson(estado, cuerpo);

      abrir();

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent("No se pudo cargar el Plan de Acción");
      expect(alerta).not.toHaveTextContent(cuerpo.mensaje);
      expect(alerta).not.toHaveTextContent(cuerpo.codigo);
    },
  );

  it.each([
    ["cuerpo vacío", new Response("", { status: 200 })],
    ["HTML", new Response("<html>proxy</html>", { status: 200 })],
    ["objeto sin filas", new Response("{}", { status: 200 })],
  ])(
    "200 con forma inválida (%s): error con Reintentar, no pantalla en blanco",
    async (_nombre, respuesta) => {
      fetchSimulado.mockResolvedValueOnce(respuesta);

      abrir();

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent("No se pudo cargar el Plan de Acción");
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    },
  );

  it("sin conexión: error con 'Reintentar'", async () => {
    fetchSimulado.mockRejectedValueOnce(new TypeError("red"));

    abrir();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No se pudo conectar con el servidor",
      ),
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});
