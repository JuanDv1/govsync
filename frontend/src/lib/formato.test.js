import { describe, expect, it } from "vitest";
import { cop } from "./formato.js";

describe("cop", () => {
  it("formatea un entero con separador de miles y prefijo en pesos", () => {
    expect(cop(1234567)).toBe("$ 1.234.567");
  });

  it("redondea decimales en vez de truncarlos", () => {
    expect(cop(999.6)).toBe("$ 1.000");
  });

  it("formatea cero sin signo negativo", () => {
    expect(cop(0)).toBe("$ 0");
  });
});
