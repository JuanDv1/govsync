/**
 * Pruebas del límite de intentos por navegador del tema de Keycloak
 * ([E-01/HU-01] CA03, decisión del PO del 2026-11-16, Opción A).
 *
 * El script vive en `keycloak/themes/govsync/login/resources/js/` (lo sirve
 * Keycloak) y aquí se prueba con Vitest: es solo experiencia de uso, el
 * bloqueo real es del servidor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BLOQUEO_MS,
  CLAVE,
  MAX_INTENTOS,
  crearLimite,
  iniciar,
} from "../../../keycloak/themes/govsync/login/resources/js/limite-intentos.js";

const MIN = 60 * 1000;

function almacenamientoEnMemoria(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
    datos,
  };
}

/** Simula una vuelta de la página: envía el formulario y recarga. */
function intento(limite, { conError }) {
  limite.alEnviar();
  return limite.alCargar(conError);
}

describe("crearLimite (contador por navegador)", () => {
  let reloj;
  let limite;
  let almacen;

  beforeEach(() => {
    reloj = 1_000_000;
    almacen = almacenamientoEnMemoria();
    limite = crearLimite({ almacenamiento: almacen, ahora: () => reloj });
  });

  it("constantes: 3 intentos y 5 minutos", () => {
    expect(MAX_INTENTOS).toBe(3);
    expect(BLOQUEO_MS).toBe(5 * MIN);
  });

  it("los dos primeros fallos no bloquean; el 3.º sí", () => {
    expect(intento(limite, { conError: true })).toBe(0);
    expect(intento(limite, { conError: true })).toBe(0);
    expect(intento(limite, { conError: true })).toBe(5 * MIN);
    expect(limite.restanteMs()).toBe(5 * MIN);
  });

  it("no depende del usuario escrito: el contador no guarda ni usa el nombre", () => {
    intento(limite, { conError: true });
    intento(limite, { conError: true });
    intento(limite, { conError: true });

    const guardado = almacen.getItem(CLAVE);
    expect(Object.keys(JSON.parse(guardado)).sort()).toEqual([
      "fallos",
      "ultimoFallo",
    ]);
    // Tres fallos seguidos bloquean aunque fueran "usuarios" distintos.
    expect(limite.restanteMs()).toBeGreaterThan(0);
  });

  it("la cuenta regresiva baja con el tiempo y se rehabilita a los 5 min", () => {
    for (let i = 0; i < 3; i += 1) intento(limite, { conError: true });

    reloj += 2 * MIN;
    expect(limite.restanteMs()).toBe(3 * MIN);

    reloj += 3 * MIN - 1;
    expect(limite.restanteMs()).toBe(1);

    reloj += 1;
    expect(limite.restanteMs()).toBe(0);
  });

  it("tras vencer, el contador empieza de cero", () => {
    for (let i = 0; i < 3; i += 1) intento(limite, { conError: true });
    reloj += 5 * MIN;

    expect(intento(limite, { conError: true })).toBe(0);
    expect(intento(limite, { conError: true })).toBe(0);
    expect(intento(limite, { conError: true })).toBe(5 * MIN);
  });

  it("dos fallos vencen a los 5 min del último", () => {
    intento(limite, { conError: true });
    intento(limite, { conError: true });
    reloj += 5 * MIN;

    expect(intento(limite, { conError: true })).toBe(0);
    expect(intento(limite, { conError: true })).toBe(0);
  });

  it("un ingreso exitoso reinicia el contador", () => {
    intento(limite, { conError: true });
    intento(limite, { conError: true });
    // Envía y NO vuelve con error (salió a la aplicación); luego la persona
    // cierra sesión y la página de login carga otra vez sin error.
    limite.alEnviar();
    limite.alCargar(false);

    expect(intento(limite, { conError: true })).toBe(0);
    expect(intento(limite, { conError: true })).toBe(0);
    expect(intento(limite, { conError: true })).toBe(5 * MIN);
  });

  it("la marca de envío es de cada pestaña: abrir el login en otra no reinicia", () => {
    const compartido = almacenamientoEnMemoria();
    const pestanaA = crearLimite({
      almacenamiento: compartido,
      sesion: almacenamientoEnMemoria(),
      ahora: () => reloj,
    });
    const pestanaB = crearLimite({
      almacenamiento: compartido,
      sesion: almacenamientoEnMemoria(),
      ahora: () => reloj,
    });

    intento(pestanaA, { conError: true });
    pestanaA.alEnviar();
    // La pestaña B abre el login sin error mientras A tiene un envío en vuelo.
    pestanaB.alCargar(false);
    // El fallo de A llega después y SÍ cuenta.
    pestanaA.alCargar(true);

    expect(JSON.parse(compartido.getItem(CLAVE)).fallos).toBe(2);
  });

  it("los fallos se comparten entre pestañas: la 2.ª ve el bloqueo de la 1.ª", () => {
    const compartido = almacenamientoEnMemoria();
    const nueva = () =>
      crearLimite({
        almacenamiento: compartido,
        sesion: almacenamientoEnMemoria(),
        ahora: () => reloj,
      });
    const pestanaA = nueva();
    for (let i = 0; i < 3; i += 1) intento(pestanaA, { conError: true });

    expect(nueva().restanteMs()).toBe(5 * MIN);
    expect(nueva().alEnviar()).toBe(false);
  });

  it("recargar la página de error sin enviar no suma fallos", () => {
    intento(limite, { conError: true });
    limite.alCargar(true);
    limite.alCargar(true);
    limite.alCargar(true);

    expect(limite.restanteMs()).toBe(0);
    expect(intento(limite, { conError: true })).toBe(0);
  });

  it("bloqueado, no deja enviar y no suma más fallos", () => {
    for (let i = 0; i < 3; i += 1) intento(limite, { conError: true });

    expect(limite.alEnviar()).toBe(false);
    expect(limite.alCargar(true)).toBe(5 * MIN);
    expect(JSON.parse(almacen.getItem(CLAVE)).fallos).toBe(3);
  });

  it("cargar la página bloqueada sin error la mantiene bloqueada", () => {
    for (let i = 0; i < 3; i += 1) intento(limite, { conError: true });
    reloj += MIN;

    expect(limite.alCargar(false)).toBe(4 * MIN);
  });

  it("un último fallo en el futuro no bloquea más de 5 min", () => {
    almacen.setItem(
      CLAVE,
      JSON.stringify({
        fallos: 3,
        ultimoFallo: reloj + 60 * MIN,
        pendiente: false,
      }),
    );

    expect(limite.restanteMs()).toBe(5 * MIN);
    // Reloj atrasado: cuenta 5 min desde ahora, no queda congelado.
    reloj += 5 * MIN;
    expect(limite.restanteMs()).toBe(0);
  });

  it.each([
    "no es json",
    "null",
    '{"fallos":"tres"}',
    '{"fallos":-4,"ultimoFallo":-1}',
    '{"fallos":null}',
    "[]",
    "",
  ])("un valor guardado inválido (%j) se trata como sin fallos", (basura) => {
    almacen.setItem(CLAVE, basura);

    expect(limite.restanteMs()).toBe(0);
    expect(intento(limite, { conError: true })).toBe(0);
  });

  it("sin almacenamiento disponible no bloquea ni falla", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    const sinAlmacen = crearLimite({
      almacenamiento: roto,
      ahora: () => reloj,
    });

    expect(() => intento(sinAlmacen, { conError: true })).not.toThrow();
    expect(sinAlmacen.restanteMs()).toBe(0);
  });
});

describe("iniciar (página con formulario)", () => {
  let almacen;
  let detener;

  let sesion;

  function pagina({ conError }) {
    document.body.innerHTML = `
      <div id="limite-intentos" role="alert">
        <div id="limite-intentos-contenido" hidden>
          <div id="limite-intentos-aviso" tabindex="-1">
            <p role="timer" id="limite-intentos-restante"></p>
          </div>
        </div>
      </div>
      <form id="kc-form-login" ${conError ? 'data-error-credenciales="true"' : ""}>
        <input id="username" name="username" />
        <input id="password" name="password" type="password" />
        <button id="kc-login" type="submit">Ingresar</button>
      </form>`;
  }

  const arrancar = () => {
    detener = iniciar({ almacenamiento: almacen, sesion });
  };

  const avisoOculto = () =>
    document.getElementById("limite-intentos-contenido").hidden;

  /** Una vuelta completa: carga la página, envía y recarga con/sin error. */
  function vuelta({ conError }) {
    pagina({ conError: false });
    arrancar();
    document
      .getElementById("kc-form-login")
      .dispatchEvent(new Event("submit", { cancelable: true }));
    detener();
    pagina({ conError });
    arrancar();
    detener();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T10:00:00Z"));
    almacen = almacenamientoEnMemoria();
    sesion = almacenamientoEnMemoria();
    detener = () => {};
  });

  afterEach(() => {
    detener();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  const estaBloqueado = () =>
    ["username", "password", "kc-login"].map(
      (id) => document.getElementById(id).disabled,
    );

  it("sin fallos previos el formulario queda habilitado y sin aviso", () => {
    pagina({ conError: false });
    arrancar();

    expect(estaBloqueado()).toEqual([false, false, false]);
    expect(avisoOculto()).toBe(true);
  });

  it("al 3.º fallo deshabilita usuario, contraseña y botón y avisa", () => {
    vuelta({ conError: true });
    vuelta({ conError: true });
    vuelta({ conError: true });
    pagina({ conError: true });
    arrancar();

    expect(estaBloqueado()).toEqual([true, true, true]);
    expect(avisoOculto()).toBe(false);
    expect(document.activeElement.id).toBe("limite-intentos-aviso");
    expect(document.getElementById("limite-intentos-restante")).toHaveProperty(
      "textContent",
      "Tiempo restante: 5:00",
    );
  });

  it("antes del 3.º fallo no bloquea", () => {
    vuelta({ conError: true });
    vuelta({ conError: true });
    pagina({ conError: true });
    arrancar();

    expect(estaBloqueado()).toEqual([false, false, false]);
  });

  it("la cuenta regresiva avanza y a los 5 min se rehabilita sola", () => {
    for (let i = 0; i < 3; i += 1) vuelta({ conError: true });
    pagina({ conError: true });
    arrancar();

    vi.advanceTimersByTime(61 * 1000);
    expect(
      document.getElementById("limite-intentos-restante").textContent,
    ).toBe("Tiempo restante: 3:59");
    expect(estaBloqueado()).toEqual([true, true, true]);

    vi.advanceTimersByTime(4 * MIN);
    expect(estaBloqueado()).toEqual([false, false, false]);
    expect(avisoOculto()).toBe(true);
    expect(document.activeElement.id).toBe("username");
  });

  it("recargar la página bloqueada la deja bloqueada", () => {
    for (let i = 0; i < 3; i += 1) vuelta({ conError: true });
    pagina({ conError: false });
    arrancar();

    expect(estaBloqueado()).toEqual([true, true, true]);
  });

  it("si se fuerza el envío estando bloqueado, se cancela", () => {
    for (let i = 0; i < 3; i += 1) vuelta({ conError: true });
    pagina({ conError: true });
    arrancar();

    const envio = new Event("submit", { cancelable: true });
    document.getElementById("kc-form-login").dispatchEvent(envio);

    expect(envio.defaultPrevented).toBe(true);
  });

  it("un envío normal no se cancela", () => {
    pagina({ conError: false });
    arrancar();

    const envio = new Event("submit", { cancelable: true });
    document.getElementById("kc-form-login").dispatchEvent(envio);

    expect(envio.defaultPrevented).toBe(false);
  });

  it("si otra pestaña ya bloqueó, el envío se cancela y esta página pasa a bloqueada con aviso", () => {
    pagina({ conError: false });
    arrancar();
    expect(estaBloqueado()).toEqual([false, false, false]);

    // La otra pestaña acumula 3 fallos (sin que esta lo sepa).
    almacen.setItem(
      CLAVE,
      JSON.stringify({ fallos: 3, ultimoFallo: Date.now() }),
    );
    const envio = new Event("submit", { cancelable: true });
    document.getElementById("kc-form-login").dispatchEvent(envio);

    expect(envio.defaultPrevented).toBe(true);
    expect(estaBloqueado()).toEqual([true, true, true]);
    expect(avisoOculto()).toBe(false);
    expect(
      document.getElementById("limite-intentos-restante").textContent,
    ).toBe("Tiempo restante: 5:00");

    vi.advanceTimersByTime(5 * MIN);
    expect(estaBloqueado()).toEqual([false, false, false]);
  });

  it("el evento storage de otra pestaña bloquea y desbloquea esta página", () => {
    pagina({ conError: false });
    arrancar();

    almacen.setItem(
      CLAVE,
      JSON.stringify({ fallos: 3, ultimoFallo: Date.now() }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: CLAVE }));
    expect(estaBloqueado()).toEqual([true, true, true]);

    almacen.removeItem(CLAVE);
    window.dispatchEvent(new StorageEvent("storage", { key: CLAVE }));
    expect(estaBloqueado()).toEqual([false, false, false]);
    expect(avisoOculto()).toBe(true);
  });

  it("un evento storage de otra clave se ignora", () => {
    pagina({ conError: false });
    arrancar();
    almacen.setItem(
      CLAVE,
      JSON.stringify({ fallos: 3, ultimoFallo: Date.now() }),
    );

    window.dispatchEvent(new StorageEvent("storage", { key: "otra" }));

    expect(estaBloqueado()).toEqual([false, false, false]);
  });

  it("sin formulario en la página no hace nada", () => {
    document.body.innerHTML = "<p>otra pantalla</p>";

    expect(() => iniciar({ almacenamiento: almacen, sesion })).not.toThrow();
  });
});
