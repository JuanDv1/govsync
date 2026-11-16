/**
 * Contrato entre `login.ftl` y `limite-intentos.js` ([E-01/HU-01] CA03).
 *
 * Las otras pruebas del script usan un HTML escrito a mano: si alguien
 * renombra un id o quita `data-error-credenciales` en la plantilla, esas
 * pruebas seguirían en verde con el límite roto. Aquí el HTML sale de
 * `login.ftl` de verdad (sin las directivas de FreeMarker).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLAVE,
  iniciar,
} from "../../../keycloak/themes/govsync/login/resources/js/limite-intentos.js";

const RAIZ = resolve(import.meta.dirname, "../../..");
const loginFtl = readFileSync(
  resolve(RAIZ, "keycloak/themes/govsync/login/login.ftl"),
  "utf-8",
);

/** HTML de la plantilla sin FreeMarker; `conError` conserva o quita el atributo. */
function htmlDeLogin({ conError }) {
  let html = loginFtl
    .replace(/<#--[\s\S]*?-->/g, "")
    .replace(/<\/?[#@][^>]*>/g, "")
    .replace(/\$\{[^}]*\}/g, "");
  if (!conError) html = html.replace(/\s*data-error-credenciales="true"/, "");
  return html;
}

const MIN = 60 * 1000;
const ids = ["username", "password", "kc-login"];

describe("login.ftl como página real del límite de intentos", () => {
  let almacen;
  let sesion;
  let detener;

  const memoria = () => {
    const datos = new Map();
    return {
      getItem: (k) => (datos.has(k) ? datos.get(k) : null),
      setItem: (k, v) => datos.set(k, String(v)),
      removeItem: (k) => datos.delete(k),
    };
  };

  const cargar = ({ conError }) => {
    document.body.innerHTML = htmlDeLogin({ conError });
    detener = iniciar({ almacenamiento: almacen, sesion });
  };

  const enviar = (usuario) => {
    if (usuario !== undefined)
      document.getElementById("username").value = usuario;
    document
      .getElementById("kc-form-login")
      .dispatchEvent(new Event("submit", { cancelable: true }));
    detener();
  };

  const bloqueados = () =>
    ids.map((id) => document.getElementById(id).disabled);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T10:00:00Z"));
    almacen = memoria();
    sesion = memoria();
    detener = () => {};
  });

  afterEach(() => {
    detener();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("la plantilla tiene los ids y atributos que el script necesita", () => {
    cargar({ conError: true });

    for (const id of [
      "kc-form-login",
      "username",
      "password",
      "kc-login",
      "limite-intentos",
      "limite-intentos-contenido",
      "limite-intentos-aviso",
      "limite-intentos-restante",
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
    expect(
      document.getElementById("kc-form-login").dataset.errorCredenciales,
    ).toBe("true");
    // Sin bloqueo, el aviso está oculto y vacío (no se ve "Límite alcanzado").
    expect(document.getElementById("limite-intentos-contenido").hidden).toBe(
      true,
    );
    expect(bloqueados()).toEqual([false, false, false]);
  });

  it("3 fallos con usuarios DISTINTOS bloquean la página real, con una sola clave", () => {
    for (const usuario of ["ana", "no.existe", "otra.cuenta"]) {
      cargar({ conError: false });
      enviar(usuario);
      cargar({ conError: true });
      detener();
    }
    cargar({ conError: true });

    expect(bloqueados()).toEqual([true, true, true]);
    expect(document.getElementById("limite-intentos-contenido").hidden).toBe(
      false,
    );
    expect(
      document.getElementById("limite-intentos-restante").textContent,
    ).toBe("Tiempo restante: 5:00");
    // Ningún nombre de usuario se guardó.
    const guardado = almacen.getItem(CLAVE);
    expect(guardado).not.toMatch(/ana|no\.existe|otra\.cuenta/);
  });

  it("al vencer se rehabilita, no deja temporizadores ni roba el foco", () => {
    for (let i = 0; i < 3; i += 1) {
      cargar({ conError: false });
      enviar();
      cargar({ conError: true });
      detener();
    }
    cargar({ conError: true });

    vi.advanceTimersByTime(5 * MIN + 1000);
    expect(bloqueados()).toEqual([false, false, false]);
    expect(vi.getTimerCount()).toBe(0);

    // La persona escribe la contraseña: el foco no vuelve al usuario.
    document.getElementById("password").focus();
    vi.advanceTimersByTime(10 * 1000);
    expect(document.activeElement.id).toBe("password");
  });

  it("una página sin error de credenciales tras un envío reinicia (decisión del PO, ver docs/SEGURIDAD.md)", () => {
    cargar({ conError: false });
    enviar("ana");
    cargar({ conError: true });
    detener();
    cargar({ conError: false });
    enviar("ana");
    // Vuelve SIN error de credenciales (p. ej. sesión o acción caducada).
    cargar({ conError: false });

    expect(JSON.parse(almacen.getItem(CLAVE)).fallos).toBe(0);
  });
});
