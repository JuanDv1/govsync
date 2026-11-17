/**
 * Pruebas de `useInactividad` ([E-01/HU-01] CA04), con temporizadores falsos.
 *
 * Las "otras pestañas" se simulan escribiendo en `localStorage` la clave
 * compartida, que es lo que hace una pestaña real al detectar actividad.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLAVE_ULTIMA_ACTIVIDAD,
  INACTIVIDAD_MS,
  useInactividad,
} from "./useInactividad.js";

const MIN = 60 * 1000;

function Sonda({ activo = true, alInactivo }) {
  useInactividad(activo, alInactivo);
  return null;
}

function avanzar(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function actividad(evento) {
  act(() => {
    window.dispatchEvent(new Event(evento));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useInactividad", () => {
  it("el límite es de 30 minutos", () => {
    expect(INACTIVIDAD_MS).toBe(30 * MIN);
  });

  it("vence a los 30 min sin actividad, una sola vez", () => {
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    avanzar(29 * MIN);
    expect(alInactivo).not.toHaveBeenCalled();

    avanzar(2 * MIN);
    expect(alInactivo).toHaveBeenCalledTimes(1);

    avanzar(60 * MIN);
    expect(alInactivo).toHaveBeenCalledTimes(1);
  });

  it("la actividad de esta pestaña reinicia el contador", () => {
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    avanzar(25 * MIN);
    actividad("keydown");
    avanzar(25 * MIN);
    expect(alInactivo).not.toHaveBeenCalled();

    avanzar(6 * MIN);
    expect(alInactivo).toHaveBeenCalledTimes(1);
  });

  it.each(["mousemove", "mousedown", "keydown", "scroll", "touchstart"])(
    "'%s' cuenta como actividad",
    (evento) => {
      const alInactivo = vi.fn();
      render(<Sonda alInactivo={alInactivo} />);

      avanzar(29 * MIN);
      actividad(evento);
      avanzar(29 * MIN);

      expect(alInactivo).not.toHaveBeenCalled();
    },
  );

  it("la renovación del token y los eventos que no son input no cuentan", () => {
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    // Un timer de fondo (como `updateToken`) y eventos que no son input.
    const renovacion = setInterval(() => {}, MIN);
    avanzar(15 * MIN);
    actividad("online");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    avanzar(16 * MIN);
    clearInterval(renovacion);

    expect(alInactivo).toHaveBeenCalledTimes(1);
  });

  it("actividad en OTRA pestaña reinicia el contador de esta", () => {
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    avanzar(25 * MIN);
    // Otra pestaña detecta input y publica su hora.
    window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(Date.now()));
    avanzar(25 * MIN);
    expect(alInactivo).not.toHaveBeenCalled();

    avanzar(6 * MIN);
    expect(alInactivo).toHaveBeenCalledTimes(1);
  });

  it("dos pestañas inactivas vencen las dos", () => {
    const alA = vi.fn();
    const alB = vi.fn();
    render(
      <>
        <Sonda alInactivo={alA} />
        <Sonda alInactivo={alB} />
      </>,
    );

    avanzar(31 * MIN);

    expect(alA).toHaveBeenCalledTimes(1);
    expect(alB).toHaveBeenCalledTimes(1);
  });

  it("una hora compartida en el futuro no aplaza el vencimiento", () => {
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    window.localStorage.setItem(
      CLAVE_ULTIMA_ACTIVIDAD,
      String(Date.now() + 24 * 60 * MIN),
    );
    avanzar(31 * MIN);

    expect(alInactivo).toHaveBeenCalledTimes(1);
  });

  it.each(["", "abc", "-5", "0", "NaN"])(
    "un valor compartido inválido (%j) se ignora",
    (basura) => {
      const alInactivo = vi.fn();
      render(<Sonda alInactivo={alInactivo} />);

      window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, basura);
      avanzar(31 * MIN);

      expect(alInactivo).toHaveBeenCalledTimes(1);
    },
  );

  it("sin localStorage sigue venciendo con la actividad de esta pestaña", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    avanzar(25 * MIN);
    actividad("mousemove");
    avanzar(25 * MIN);
    expect(alInactivo).not.toHaveBeenCalled();

    avanzar(6 * MIN);
    expect(alInactivo).toHaveBeenCalledTimes(1);
  });

  it("si el cierre de sesión falla, se reintenta en la siguiente revisión", async () => {
    const alInactivo = vi
      .fn()
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValue(undefined);
    render(<Sonda alInactivo={alInactivo} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31 * MIN);
    });
    expect(alInactivo).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * MIN);
    });
    expect(alInactivo).toHaveBeenCalledTimes(2);
  });

  it("con el reloj atrasado el cierre no se aplaza más de 30 min", () => {
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    avanzar(20 * MIN);
    vi.setSystemTime(Date.now() - 60 * MIN);
    avanzar(11 * 1000);
    expect(alInactivo).not.toHaveBeenCalled();

    avanzar(31 * MIN);
    expect(alInactivo).toHaveBeenCalledTimes(1);
  });

  it("vence justo en el límite", () => {
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    avanzar(30 * MIN - 10 * 1000);
    expect(alInactivo).not.toHaveBeenCalled();
    avanzar(10 * 1000);
    expect(alInactivo).toHaveBeenCalledTimes(1);
  });

  it("no vigila sin sesión", () => {
    const alInactivo = vi.fn();
    render(<Sonda activo={false} alInactivo={alInactivo} />);

    avanzar(120 * MIN);

    expect(alInactivo).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD)).toBeNull();
  });

  it("al iniciar ignora la hora vieja de una sesión anterior", () => {
    window.localStorage.setItem(
      CLAVE_ULTIMA_ACTIVIDAD,
      String(Date.now() - 5 * 60 * MIN),
    );
    const alInactivo = vi.fn();
    render(<Sonda alInactivo={alInactivo} />);

    avanzar(11 * 1000);

    expect(alInactivo).not.toHaveBeenCalled();
  });

  it("al desmontar deja de vigilar y limpia la hora compartida", () => {
    const alInactivo = vi.fn();
    const { unmount } = render(<Sonda alInactivo={alInactivo} />);

    unmount();
    avanzar(120 * MIN);

    expect(alInactivo).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD)).toBeNull();
  });
});
