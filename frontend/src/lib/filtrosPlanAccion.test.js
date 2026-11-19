/**
 * Pruebas de `filtrosPlanAccion.js` (lógica pura, sin DOM).
 *
 * TARJETA: [E04-HU02] Filtrar el Plan de Acción (frontend)
 * CRITERIOS: HU02-CA02 a CA06, CA09 (ver docstring del módulo probado).
 *
 * Primera prueba automatizada de frontend del repo (Sprint 3) -- se eligió
 * este archivo como punto de partida porque es el único módulo de
 * `src/lib` con lógica de negocio real replicada del backend (normalización
 * de texto, combinación AND/OR de filtros, cálculo del resumen): es donde
 * un error de "código ya no coincide con la regla documentada" tiene más
 * costo y menos aviso visual inmediato que un error de layout.
 */
import { describe, expect, it } from "vitest";
import {
  FILTROS_PLAN_VACIOS,
  MINIMO_BUSQUEDA,
  busquedaAplicable,
  calcularResumen,
  consultaDeFiltros,
  contarActivosPlan,
  filtrarPlanAccion,
  hayFiltrosPlan,
  normalizarBusqueda,
  opcionesIndicador,
  opcionesSector,
} from "./filtrosPlanAccion";

const FILA_BASE = {
  cod_indicador_producto: "040110500",
  nombre_producto: "Vías pavimentadas mantenidas",
  sector: "Transporte",
  estado_cruce: "completo",
};

function fila(overrides) {
  return { ...FILA_BASE, ...overrides };
}

describe("normalizarBusqueda", () => {
  it("ignora mayúsculas y tildes (HU02-CA04)", () => {
    expect(normalizarBusqueda("Educación")).toBe("educacion");
    expect(normalizarBusqueda("VÍAS")).toBe("vias");
  });

  it("devuelve cadena vacía para null/undefined, nunca lanza", () => {
    expect(normalizarBusqueda(null)).toBe("");
    expect(normalizarBusqueda(undefined)).toBe("");
  });
});

describe("busquedaAplicable", () => {
  it(`exige al menos ${MINIMO_BUSQUEDA} caracteres (HU02-CA04)`, () => {
    expect(busquedaAplicable("ed")).toBe("");
    expect(busquedaAplicable("edu")).toBe("edu");
  });

  it("recorta espacios antes de medir la longitud", () => {
    expect(busquedaAplicable("  ed  ")).toBe("");
    expect(busquedaAplicable("  edu  ")).toBe("edu");
  });

  it("cuenta la longitud ya normalizada (tildes no cuentan extra)", () => {
    // 3 caracteres visibles, igual de largos normalizados: debe aplicar.
    expect(busquedaAplicable("víá")).toBe("víá");
  });
});

describe("filtrarPlanAccion", () => {
  const filas = [
    fila({
      cod_indicador_producto: "A1",
      sector: "Educación",
      estado_cruce: "completo",
    }),
    fila({
      cod_indicador_producto: "A2",
      sector: "Salud",
      estado_cruce: "parcial",
    }),
    fila({
      cod_indicador_producto: "A3",
      sector: null,
      estado_cruce: "sin_informacion",
      nombre_producto: null,
    }),
  ];

  it("sin filtros devuelve todas las filas, mismo orden (HU02-CA08)", () => {
    expect(filtrarPlanAccion(filas, FILTROS_PLAN_VACIOS)).toEqual(filas);
  });

  it("filtra por sector exacto; una fila con sector null nunca coincide", () => {
    const resultado = filtrarPlanAccion(filas, {
      ...FILTROS_PLAN_VACIOS,
      sector: ["Educación"],
    });
    expect(resultado.map((f) => f.cod_indicador_producto)).toEqual(["A1"]);
  });

  it("sector es OR dentro del criterio (HU02-CA05)", () => {
    const resultado = filtrarPlanAccion(filas, {
      ...FILTROS_PLAN_VACIOS,
      sector: ["Educación", "Salud"],
    });
    expect(resultado.map((f) => f.cod_indicador_producto)).toEqual([
      "A1",
      "A2",
    ]);
  });

  it("filtra por estado_cruce", () => {
    const resultado = filtrarPlanAccion(filas, {
      ...FILTROS_PLAN_VACIOS,
      estado_cruce: ["sin_informacion"],
    });
    expect(resultado.map((f) => f.cod_indicador_producto)).toEqual(["A3"]);
  });

  it("filtra por cod_indicador_producto (D27: filtro exacto, no texto libre)", () => {
    const resultado = filtrarPlanAccion(filas, {
      ...FILTROS_PLAN_VACIOS,
      cod_indicador_producto: ["A2"],
    });
    expect(resultado.map((f) => f.cod_indicador_producto)).toEqual(["A2"]);
  });

  it("combina dos criterios distintos con AND (HU02-CA05)", () => {
    const resultado = filtrarPlanAccion(filas, {
      ...FILTROS_PLAN_VACIOS,
      sector: ["Educación", "Salud"],
      estado_cruce: ["parcial"],
    });
    expect(resultado.map((f) => f.cod_indicador_producto)).toEqual(["A2"]);
  });

  it("busqueda compara código o nombre, sin distinguir mayúsculas/tildes", () => {
    const resultado = filtrarPlanAccion(filas, {
      ...FILTROS_PLAN_VACIOS,
      busqueda: "a1",
    });
    expect(resultado.map((f) => f.cod_indicador_producto)).toEqual(["A1"]);
  });

  it("busqueda nunca falla sobre nombre_producto null", () => {
    const resultado = filtrarPlanAccion(filas, {
      ...FILTROS_PLAN_VACIOS,
      busqueda: "a3",
    });
    expect(resultado.map((f) => f.cod_indicador_producto)).toEqual(["A3"]);
  });
});

describe("calcularResumen", () => {
  it("total siempre cuadra (parcial sale por diferencia)", () => {
    const filas = [
      fila({ estado_cruce: "completo" }),
      fila({ estado_cruce: "completo" }),
      fila({ estado_cruce: "parcial" }),
      fila({ estado_cruce: "sin_informacion" }),
    ];
    expect(calcularResumen(filas)).toEqual({
      total: 4,
      completo: 2,
      parcial: 1,
      sin_informacion: 1,
    });
  });

  it("lista vacía da un resumen en cero, no lanza", () => {
    expect(calcularResumen([])).toEqual({
      total: 0,
      completo: 0,
      parcial: 0,
      sin_informacion: 0,
    });
  });
});

describe("opcionesSector", () => {
  it("descarta null, sin duplicados, orden alfabético en español", () => {
    const filas = [
      fila({ sector: "Transporte" }),
      fila({ sector: null }),
      fila({ sector: "Educación" }),
      fila({ sector: "Transporte" }),
    ];
    expect(opcionesSector(filas)).toEqual([
      { valor: "Educación", texto: "Educación" },
      { valor: "Transporte", texto: "Transporte" },
    ]);
  });
});

describe("opcionesIndicador", () => {
  it('muestra "código – nombre", o solo el código si no hay nombre', () => {
    const filas = [
      fila({ cod_indicador_producto: "B2", nombre_producto: "Nombre B" }),
      fila({ cod_indicador_producto: "A1", nombre_producto: null }),
    ];
    // Orden por código como texto (HU02-CA09), no por nombre.
    expect(opcionesIndicador(filas)).toEqual([
      { valor: "A1", texto: "A1" },
      { valor: "B2", texto: "B2 – Nombre B" },
    ]);
  });
});

describe("consultaDeFiltros", () => {
  it("sin ningún criterio devuelve cadena vacía (exporta todo)", () => {
    expect(consultaDeFiltros(FILTROS_PLAN_VACIOS)).toBe("");
  });

  it("repite la clave por cada valor de una lista (OR dentro del criterio)", () => {
    const query = consultaDeFiltros({
      ...FILTROS_PLAN_VACIOS,
      sector: ["Educación", "Salud"],
    });
    expect(query).toBe("sector=Educaci%C3%B3n&sector=Salud");
  });

  it("incluye busqueda solo si no está vacía", () => {
    expect(
      consultaDeFiltros({ ...FILTROS_PLAN_VACIOS, busqueda: "vías" }),
    ).toBe("busqueda=v%C3%ADas");
  });
});

describe("contarActivosPlan / hayFiltrosPlan", () => {
  it("cuenta un valor por cada elemento de lista, más uno por búsqueda", () => {
    const filtros = {
      sector: ["A", "B"],
      estado_cruce: ["completo"],
      cod_indicador_producto: [],
      busqueda: "texto",
    };
    expect(contarActivosPlan(filtros)).toBe(4);
    expect(hayFiltrosPlan(filtros)).toBe(true);
  });

  it("sin ningún criterio activo, cuenta 0 y hayFiltrosPlan es false", () => {
    expect(contarActivosPlan(FILTROS_PLAN_VACIOS)).toBe(0);
    expect(hayFiltrosPlan(FILTROS_PLAN_VACIOS)).toBe(false);
  });
});
