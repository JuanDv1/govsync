/**
 * Lógica pura de los filtros de la matriz de relación.
 *
 * TARJETA: [E02-HU10] Filtrar la matriz de relación (frontend)
 * CRITERIOS: HU10-CA01 a CA10, CA12, CA16 (ver docs/specs/E02-HU10-*.md)
 *
 * Sin React, sin fetch, sin efectos: solo funciones sobre datos, para que se
 * puedan razonar (y probar) sin montar ningún componente. Mismo criterio que
 * `formato.js`.
 *
 * DOS NOMBRES POR CRITERIO, QUE NO COINCIDEN
 * El backend usa un nombre para la lista de opciones
 * (`GET /matriz-relacion/{corte}/opciones-filtro`) y otro para el query
 * param de filtro de `GET /matriz-relacion/{corte}`:
 *
 *     opciones (`claveOpciones`)  ->  filtro (`clave`)
 *     bpin                        ->  bpin
 *     indicadores                 ->  cod_indicador_producto
 *     productos                   ->  producto
 *     contratos                   ->  numero_contrato
 *     sectores                    ->  sector
 *     programas                   ->  programa
 *
 * `CRITERIOS` es el único lugar donde vive ese mapeo.
 *
 * REGLA DE LOS CÓDIGOS: BPIN, códigos de indicador y números de contrato son
 * texto. Nunca `Number()`/`parseInt()` sobre ellos (los reales empiezan con
 * cero, p. ej. 040110500).
 */

/**
 * Los seis criterios, en el orden en que se muestran en el panel.
 *
 * - `clave`: nombre del query param de filtro (y clave dentro de `filtros`).
 * - `titulo`: texto para la UI.
 * - `claveOpciones`: lista correspondiente en la respuesta de
 *   `opciones-filtro`.
 * - `modo`: "autocompletado" (HU10-CA03: BPIN y Contrato; se sugiere a
 *   partir de `minimoCaracteres`, con tope de `MAXIMO_SUGERENCIAS`) o
 *   "lista" (buscador desde 0 caracteres, sin tope: HU10-CA04 y los demás
 *   criterios de lista cerrada).
 * - `minimoCaracteres`: solo en modo "autocompletado"; caracteres mínimos
 *   para empezar a sugerir. Distinto por criterio.
 *
 * Programa es el sexto criterio (HU10-CA16): confirmado por el PO (2026-10-16).
 */
export const CRITERIOS = [
  {
    clave: "bpin",
    titulo: "BPIN",
    claveOpciones: "bpin",
    modo: "autocompletado",
    minimoCaracteres: 3,
  },
  {
    clave: "cod_indicador_producto",
    titulo: "Indicador",
    claveOpciones: "indicadores",
    modo: "lista",
  },
  {
    clave: "producto",
    titulo: "Producto",
    claveOpciones: "productos",
    modo: "lista",
  },
  {
    clave: "numero_contrato",
    titulo: "Contrato",
    claveOpciones: "contratos",
    modo: "autocompletado",
    // Mínimo 1 por números cortos reales (p. ej. "12"); confirmado por el PO
    // (2026-10-15).
    minimoCaracteres: 1,
  },
  {
    clave: "sector",
    titulo: "Sector",
    claveOpciones: "sectores",
    modo: "lista",
  },
  {
    clave: "programa",
    titulo: "Programa",
    claveOpciones: "programas",
    modo: "lista",
  },
];

/** HU10-CA03: tope de sugerencias en modo "autocompletado". */
export const MAXIMO_SUGERENCIAS = 10;

// Mismas seis claves que `CLAVES_FILTRO_MATRIZ` en api/cliente.js (que es
// lo que `api.matriz` recorre al armar el query string). No se importa de
// allí a propósito: esa constante no se exporta y este módulo es puro. Si
// una cambia, la otra debe cambiar con ella.
/** Estado de filtros sin ningún valor seleccionado. */
export const FILTROS_VACIOS = {
  bpin: [],
  cod_indicador_producto: [],
  producto: [],
  numero_contrato: [],
  sector: [],
  programa: [],
};

/**
 * Forma de comparar un texto escrito con las opciones (HU10-CA03): sin
 * distinguir mayúsculas ni guiones. NO quita tildes (decisión Q4).
 */
export function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .replaceAll("-", "");
}

/**
 * Límites de búsqueda de un criterio según su `modo`: `{ minimo, maximo }`
 * listos para pasar a `sugerir`. `maximo` es `undefined` (sin tope) en modo
 * "lista".
 */
export function limitesDeBusqueda(criterio) {
  if (criterio.modo === "autocompletado") {
    return { minimo: criterio.minimoCaracteres, maximo: MAXIMO_SUGERENCIAS };
  }
  return { minimo: 0, maximo: undefined };
}

/**
 * Convierte la lista cruda de `opciones-filtro` de un criterio en
 * `[{ valor, texto }]`.
 *
 * - `valor` es lo que viaja al backend (comparación exacta, nunca se
 *   normaliza).
 * - `texto` es lo que ve y busca el usuario.
 * - Indicadores (HU10-CA04): llegan como `{ codigo, nombre }`; `valor` es
 *   el código y `texto` es "código – nombre" (solo el código si `nombre`
 *   es null).
 * - El resto llega como strings: `valor` y `texto` son el mismo.
 *
 * Tolera una respuesta o una lista ausente: devuelve `[]`.
 */
export function opcionesParaCriterio(opcionesFiltro, criterio) {
  const lista = opcionesFiltro?.[criterio.claveOpciones];
  if (!Array.isArray(lista)) return [];

  if (criterio.claveOpciones === "indicadores") {
    return lista.map(({ codigo, nombre }) => ({
      valor: codigo,
      texto: nombre ? `${codigo} – ${nombre}` : codigo,
    }));
  }
  return lista.map((valor) => ({ valor, texto: valor }));
}

/**
 * Opciones cuyo `texto` contiene el texto escrito (HU10-CA03), sin
 * distinguir mayúsculas ni guiones.
 *
 * - `texto`: lo que escribió la persona. Se normaliza y se recortan los
 *   espacios de los extremos (solo de este texto, no del de las opciones).
 * - `minimo`: si el texto ya recortado y normalizado tiene menos
 *   caracteres, devuelve `[]` (por defecto 0: con texto vacío devuelve
 *   todo).
 * - `maximo`: tope de resultados; `undefined` = sin tope.
 * - `excluir`: valores ya seleccionados, que no se vuelven a sugerir.
 *
 * Devuelve los mismos objetos `{ valor, texto }` recibidos, en su orden
 * original: `valor` nunca se altera.
 */
export function sugerir(opciones, texto, { minimo = 0, maximo, excluir } = {}) {
  const buscado = normalizar(texto).trim();
  if (buscado.length < minimo) return [];

  const excluidos = new Set(excluir ?? []);
  const resultado = [];
  for (const opcion of opciones ?? []) {
    if (excluidos.has(opcion.valor)) continue;
    if (!normalizar(opcion.texto).includes(buscado)) continue;
    resultado.push(opcion);
    if (maximo !== undefined && resultado.length >= maximo) break;
  }
  return resultado;
}

/** Total de valores seleccionados entre todos los criterios. */
export function contarActivos(filtros) {
  return Object.keys(FILTROS_VACIOS).reduce(
    (total, clave) => total + (filtros?.[clave]?.length ?? 0),
    0,
  );
}

/** `true` si hay al menos un valor seleccionado en algún criterio. */
export function hayFiltros(filtros) {
  return contarActivos(filtros) > 0;
}

/**
 * Filtros nuevos con `valor` añadido a `clave` (HU10-CA08: varios valores
 * del mismo criterio). No muta `filtros` y no duplica valores.
 */
export function agregarValor(filtros, clave, valor) {
  const actuales = filtros[clave] ?? [];
  if (actuales.includes(valor)) return { ...filtros };
  return { ...filtros, [clave]: [...actuales, valor] };
}

/**
 * Filtros nuevos sin `valor` en `clave` (HU10-CA10: quitar una etiqueta
 * conserva los demás filtros). No muta `filtros`.
 */
export function quitarValor(filtros, clave, valor) {
  const actuales = filtros[clave] ?? [];
  return { ...filtros, [clave]: actuales.filter((v) => v !== valor) };
}
