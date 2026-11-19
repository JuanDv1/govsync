/**
 * Pruebas de `rutaDestinoSegura` ([E-01/HU-01] CA07).
 *
 * El valor viaja por el estado de navegación, que cualquiera puede
 * manipular: solo debe salir una ruta interna.
 */
import { describe, expect, it } from "vitest";
import { RUTA_POR_DEFECTO, rutaDestinoSegura } from "./rutaDestino.js";

describe("rutaDestinoSegura", () => {
  it("el destino por defecto es '/' (la vista inicial del rol)", () => {
    expect(RUTA_POR_DEFECTO).toBe("/");
  });

  it.each([
    "/cortes",
    "/cortes/nuevo",
    "/plan-accion/comparar?vigencia=2026",
    "/matriz/3#fila",
    "/loginx",
    "/",
  ])("acepta la ruta interna %s", (ruta) => {
    expect(rutaDestinoSegura(ruta)).toBe(ruta);
  });

  it.each([
    "//evil.com",
    "//evil.com/cortes",
    "///evil.com",
    "/\\evil.com",
    "/cortes\\..\\x",
    "\\\\evil.com",
    "https://evil.com",
    "http://localhost:5173/cortes",
    "javascript:alert(1)",
    "cortes",
    "",
    " /cortes",
  ])("rechaza %j", (ruta) => {
    expect(rutaDestinoSegura(ruta)).toBe(RUTA_POR_DEFECTO);
  });

  it.each([
    "/login",
    "/login/",
    "/login?x=1",
    "/login#a",
    "/login/x",
    "/LOGIN",
  ])("rechaza la propia pantalla de login (%s)", (ruta) => {
    expect(rutaDestinoSegura(ruta)).toBe(RUTA_POR_DEFECTO);
  });

  it.each([
    "/cortes\nSet-Cookie: x",
    "/cortes\r\n",
    "/a\tb",
    "/a\u0000b",
    "/a\u007fb",
  ])("rechaza caracteres de control (%j)", (ruta) => {
    expect(rutaDestinoSegura(ruta)).toBe(RUTA_POR_DEFECTO);
  });

  it.each([undefined, null, 5, {}, [], ["/cortes"], true])(
    "un valor que no es texto (%j) cae al destino por defecto",
    (valor) => {
      expect(rutaDestinoSegura(valor)).toBe(RUTA_POR_DEFECTO);
    },
  );
});
