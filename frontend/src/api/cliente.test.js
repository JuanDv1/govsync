/**
 * Pruebas del método público de `api/cliente.js`.
 *
 * TARJETA: [E-01/HU-01] FE - Acceso como visitante sin credenciales
 * DECISIÓN DEL PO: la consulta pública NO adjunta `Authorization`, ni siquiera
 * si hay sesión. Se usa el cliente real con `fetch` reemplazado, y un
 * proveedor de token que SÍ devuelve uno: así falla si alguien deja pasar el
 * token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, establecerProveedorToken } from "./cliente.js";

const fetchSimulado = vi.fn();

function responder(estado, cuerpo) {
  fetchSimulado.mockResolvedValueOnce(
    new Response(cuerpo === undefined ? "" : JSON.stringify(cuerpo), {
      status: estado,
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSimulado);
  establecerProveedorToken(() => "token-secreto");
});

afterEach(() => {
  fetchSimulado.mockReset();
  vi.unstubAllGlobals();
  establecerProveedorToken(() => null);
});

describe("api.planAccionPublicoActual", () => {
  it("pide el endpoint público sin Authorization aunque haya token", async () => {
    responder(200, { filas: [] });

    await api.planAccionPublicoActual();

    const [url, opciones] = fetchSimulado.mock.calls[0];
    expect(url).toBe("/api/v1/publico/plan-accion/actual");
    expect(opciones.method).toBe("GET");
    expect(opciones.headers).not.toHaveProperty("Authorization");
    expect(JSON.stringify(opciones.headers)).not.toContain("token-secreto");
  });

  it("no manda cookies (credentials: omit)", async () => {
    responder(200, { filas: [] });

    await api.planAccionPublicoActual();

    expect(fetchSimulado.mock.calls[0][1].credentials).toBe("omit");
  });

  it("control: el método con sesión SÍ manda el token", async () => {
    responder(200, { filas: [] });

    await api.planAccionActual();

    const [url, opciones] = fetchSimulado.mock.calls[0];
    expect(url).toBe("/api/v1/plan-accion/actual");
    expect(opciones.headers.Authorization).toBe("Bearer token-secreto");
  });

  it.each([404, 409, 429])(
    "el %i llega como ErrorApi con su estado",
    async (estado) => {
      responder(estado, { codigo: "x", mensaje: "texto", detalles: {} });

      await expect(api.planAccionPublicoActual()).rejects.toMatchObject({
        name: "ErrorApi",
        estado,
      });
    },
  );

  it("un 429 sin cuerpo JSON también es ErrorApi con estado 429", async () => {
    responder(429);

    await expect(api.planAccionPublicoActual()).rejects.toMatchObject({
      estado: 429,
    });
  });

  it("sin conexión lanza error_red", async () => {
    fetchSimulado.mockRejectedValueOnce(new TypeError("fallo"));

    await expect(api.planAccionPublicoActual()).rejects.toMatchObject({
      codigo: "error_red",
    });
  });
});
