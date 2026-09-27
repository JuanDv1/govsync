import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ErrorApi } from "./cliente.js";

function mockearFetch(respuesta) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: respuesta.ok,
      status: respuesta.status,
      text: async () => JSON.stringify(respuesta.cuerpo ?? {}),
    }),
  );
}

describe("api cliente", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listarCortes devuelve los datos cuando la respuesta es 200", async () => {
    mockearFetch({ ok: true, status: 200, cuerpo: [{ id: 1 }] });

    const datos = await api.listarCortes();

    expect(datos).toEqual([{ id: 1 }]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/cortes"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("lanza ErrorApi con código y detalles cuando el backend responde 409", async () => {
    mockearFetch({
      ok: false,
      status: 409,
      cuerpo: {
        codigo: "archivos_faltantes",
        mensaje: "Faltan archivos por cargar.",
        detalles: { archivos_faltantes: ["PDT"] },
      },
    });

    await expect(api.registrarCorte(1)).rejects.toMatchObject({
      message: "Faltan archivos por cargar.",
      codigo: "archivos_faltantes",
      detalles: { archivos_faltantes: ["PDT"] },
      estado: 409,
    });
  });

  it("lanza ErrorApi de red cuando fetch rechaza (sin conexión)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(api.listarCortes()).rejects.toBeInstanceOf(ErrorApi);
    await expect(api.listarCortes()).rejects.toMatchObject({
      codigo: "error_red",
    });
  });
});
