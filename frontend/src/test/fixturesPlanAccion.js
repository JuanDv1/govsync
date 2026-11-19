/**
 * Datos de prueba compartidos de las pantallas del Plan de Acción
 * (PlanAccion.test.jsx y PlanAccionPublico.test.jsx): una fila de la
 * respuesta de `/plan-accion/actual` y un plan de dos metas.
 */

export function fila(sobreescribir) {
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

export const PLAN = {
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
