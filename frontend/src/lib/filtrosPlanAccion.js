/**
 * Lógica pura de los filtros del Plan de Acción.
 *
 * TARJETA: [E04-HU02] Filtrar el Plan de Acción (frontend)
 * CRITERIOS: HU02-CA01 a CA09 (ver docs/specs/E04-HU02-filtrar-plan-accion.md)
 *
 * Sin React, sin fetch, sin efectos: solo funciones sobre datos, igual que
 * `filtros.js` (matriz) y `formato.js`.
 *
 * REPLICA AL BACKEND. El filtrado se hace en memoria sobre las filas que ya
 * trajo `GET /plan-accion/actual`, con la misma regla que aplica el backend en
 * `backend/app/modules/plan_accion/domain/entidades.py`
 * (`_normalizar_texto`, `filtrar_plan_accion` y `calcular_resumen`). Si la
 * regla cambia allí, cambia aquí.
 *
 * LAS CLAVES DE `filtros` SON LOS NOMBRES DE LOS QUERY PARAMS del backend
 * (`sector`, `estado_cruce`, `busqueda`, `cod_indicador_producto`): el mismo
 * objeto se puede mandar tal cual a `/actual` y a `/exportar` (E04-HU03) sin
 * traducir nada. Por eso `busqueda` guarda solo el texto YA aplicable
 * (recortado y de 3 o más caracteres, ver `busquedaAplicable`): el backend ni
 * recorta ni exige el mínimo, así que mandar este objeto da el mismo
 * resultado que el filtro local.
 *
 * REGLA DE LOS CÓDIGOS: `cod_indicador_producto` es texto. Nunca
 * `Number()`/`parseInt()` (los reales empiezan con cero, p. ej. 040110500).
 */

/** HU02-CA04: caracteres mínimos para que el texto de "Meta" filtre. */
export const MINIMO_BUSQUEDA = 3;

/** Estado de filtros sin ningún valor seleccionado. */
export const FILTROS_PLAN_VACIOS = {
  sector: [],
  estado_cruce: [],
  busqueda: "",
  cod_indicador_producto: [],
};

/**
 * Forma de comparar el texto de "Meta" (HU02-CA04): sin distinguir
 * mayúsculas ni tildes. Equivale a `_normalizar_texto` del backend (NFKD,
 * descartar las marcas `Mn`, `casefold`). Diferencia residual: `casefold`
 * también pliega casos que `toLowerCase` no (p. ej. «ß» → «ss»); no se
 * esperan en datos en español.
 */
export function normalizarBusqueda(texto) {
  return String(texto ?? "")
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
}

/**
 * Lo que se guarda en `filtros.busqueda` a partir de lo escrito: el texto
 * recortado si tiene `MINIMO_BUSQUEDA` o más caracteres, y `""` si no (con
 * menos no se filtra).
 */
export function busquedaAplicable(texto) {
  const recortado = String(texto ?? "").trim();
  return normalizarBusqueda(recortado).length >= MINIMO_BUSQUEDA
    ? recortado
    : "";
}

/**
 * Filas que cumplen los filtros (HU02-CA02 a CA05, CA09): AND entre criterios
 * y OR dentro de cada lista. Conserva el orden de `filas`.
 *
 * - `sector` y `cod_indicador_producto`: igualdad exacta. Una fila con
 *   `sector` null no coincide con ningún sector.
 * - `estado_cruce`: igualdad con el valor del backend (`completo`,
 *   `parcial`, `sin_informacion`).
 * - `busqueda`: contiene, sobre el código o el nombre (si no es null).
 */
export function filtrarPlanAccion(filas, filtros) {
  let resultado = filas;

  if (filtros.sector?.length) {
    const sectores = new Set(filtros.sector);
    resultado = resultado.filter((fila) => sectores.has(fila.sector));
  }

  if (filtros.estado_cruce?.length) {
    const estados = new Set(filtros.estado_cruce);
    resultado = resultado.filter((fila) => estados.has(fila.estado_cruce));
  }

  if (filtros.cod_indicador_producto?.length) {
    const codigos = new Set(filtros.cod_indicador_producto);
    resultado = resultado.filter((fila) =>
      codigos.has(fila.cod_indicador_producto),
    );
  }

  if (filtros.busqueda) {
    const patron = normalizarBusqueda(filtros.busqueda);
    resultado = resultado.filter(
      (fila) =>
        normalizarBusqueda(fila.cod_indicador_producto).includes(patron) ||
        (fila.nombre_producto != null &&
          normalizarBusqueda(fila.nombre_producto).includes(patron)),
    );
  }

  return resultado;
}

/**
 * Resumen del pie (HU02-CA06), calculado sobre las filas ya filtradas. Igual
 * que `calcular_resumen` del backend: `total` es `filas.length` y `parcial`
 * sale por diferencia, así que la suma siempre cuadra.
 */
export function calcularResumen(filas) {
  const completo = filas.filter((f) => f.estado_cruce === "completo").length;
  const sinInformacion = filas.filter(
    (f) => f.estado_cruce === "sin_informacion",
  ).length;
  const total = filas.length;
  return {
    total,
    completo,
    parcial: total - completo - sinInformacion,
    sin_informacion: sinInformacion,
  };
}

/**
 * Opciones del filtro de Sector: los sectores distintos de las filas, sin los
 * null (no hay forma de pedirle "sin sector" al backend), en orden alfabético.
 * Devuelve `[{ valor, texto }]`, el formato de `SelectorConBusqueda`.
 */
export function opcionesSector(filas) {
  const sectores = new Set();
  for (const fila of filas) {
    if (fila.sector != null) sectores.add(fila.sector);
  }
  return [...sectores]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((sector) => ({ valor: sector, texto: sector }));
}

/**
 * Opciones del filtro de Indicador (HU02-CA09): una por meta, "código –
 * nombre" (solo el código si no hay nombre), igual que la matriz. `valor` es
 * el código, que es lo que se compara de forma exacta. Orden por código como
 * texto.
 */
export function opcionesIndicador(filas) {
  return filas
    .map(({ cod_indicador_producto: codigo, nombre_producto: nombre }) => ({
      valor: codigo,
      texto: nombre ? `${codigo} – ${nombre}` : codigo,
    }))
    .sort((a, b) => a.valor.localeCompare(b.valor, "es"));
}

/**
 * Query string de `GET /plan-accion/exportar` (E04-HU03) para estos filtros:
 * los mismos query params que `/actual`. Repite la clave por cada valor de
 * una lista (`sector=a&sector=b`, OR dentro del criterio) y omite las listas
 * vacías y la búsqueda vacía. Los textos van codificados en UTF-8 y el
 * espacio como «+», que el backend decodifica igual. Devuelve `""` si no hay
 * ningún criterio (exporta todo).
 */
export function consultaDeFiltros(filtros) {
  const parametros = new URLSearchParams();
  for (const clave of ["sector", "estado_cruce", "cod_indicador_producto"]) {
    for (const valor of filtros[clave] ?? []) parametros.append(clave, valor);
  }
  if (filtros.busqueda) parametros.append("busqueda", filtros.busqueda);
  return parametros.toString();
}

/** Total de criterios activos: un valor por cada elemento de las listas, más
 * uno si hay texto de "Meta". */
export function contarActivosPlan(filtros) {
  return (
    (filtros.sector?.length ?? 0) +
    (filtros.estado_cruce?.length ?? 0) +
    (filtros.cod_indicador_producto?.length ?? 0) +
    (filtros.busqueda ? 1 : 0)
  );
}

/** `true` si hay al menos un criterio activo. */
export function hayFiltrosPlan(filtros) {
  return contarActivosPlan(filtros) > 0;
}
