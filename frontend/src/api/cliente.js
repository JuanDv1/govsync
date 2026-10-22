/**
 * Cliente HTTP único de GovSync.
 *
 * TARJETA: [UX-01] Layout base, enrutamiento y cliente HTTP
 *
 * Centraliza tres cosas que no deben repetirse en cada componente: la URL
 * base, las cabeceras y la traducción de los errores del backend a un objeto
 * de error uniforme.
 *
 * El backend responde los errores de negocio con esta forma (ver
 * app/core/errores.py):
 *
 *     { "codigo": "...", "mensaje": "...", "detalles": { ... } }
 *
 * `detalles` es lo que hace accionable un error: trae `columnas_faltantes`,
 * `pestanas_faltantes` o `archivos_faltantes` según el caso. [UX-03] depende
 * de que este cliente NO los descarte.
 */
import { nombreDeContentDisposition } from "../lib/descarga.js";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// [HU-E01-01] / D23/D24: el token vive en ProveedorAutenticacion.jsx, no
// aquí — este módulo solo necesita una forma de leerlo en cada petición.
// Por defecto no hay token (p. ej. en pruebas que no montan el provider).
let obtenerToken = () => null;

/** Llamado una vez por ProveedorAutenticacion.jsx al inicializar Keycloak. */
export function establecerProveedorToken(fn) {
  obtenerToken = fn;
}

export class ErrorApi extends Error {
  constructor(mensaje, { estado, codigo, detalles } = {}) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles ?? {};
  }
}
async function solicitar(ruta, { metodo = "GET", cuerpo, archivo } = {}) {
  const headers = {
    Accept: "application/json",
  };

  const token = obtenerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const opciones = {
    method: metodo,
    headers,
  };

  if (archivo) {
    const formulario = new FormData();
    formulario.append("archivo", archivo);
    opciones.body = formulario;
  } else if (cuerpo !== undefined) {
    headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }

  let respuesta;

  try {
    respuesta = await fetch(`${BASE}${ruta}`, opciones);
  } catch {
    throw new ErrorApi("No se pudo conectar con el servidor.", {
      codigo: "error_red",
      detalles: {},
    });
  }

  const contenido = await respuesta.text();
  let datos = null;

  if (contenido) {
    try {
      datos = JSON.parse(contenido);
    } catch {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    throw new ErrorApi(datos?.mensaje ?? "No se pudo completar la solicitud.", {
      estado: respuesta.status,
      codigo: datos?.codigo,
      detalles: datos?.detalles,
    });
  }

  return datos;
}

// HU-10: claves de filtro de la matriz, tal como las declara el backend
// (`trazabilidad/api/router.py::obtener_matriz`). Un criterio por clave.
const CLAVES_FILTRO_MATRIZ = [
  "bpin",
  "cod_indicador_producto",
  "producto",
  "numero_contrato",
  "sector",
  "programa",
];

const TIPO_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * [E04-HU03] Descarga un `.xlsx` autenticado.
 *
 * Es una función aparte, y repite a propósito las cabeceras y la construcción
 * del `ErrorApi` de `solicitar`, porque `solicitar` lee SIEMPRE la respuesta
 * con `.text()` y la parsea como JSON: con un archivo binario corrompería los
 * bytes. No se extrajo código común para no tocar `solicitar`, que usan todas
 * las pantallas y no tiene pruebas automáticas.
 *
 * Devuelve `{ blob, nombre }`. `nombre` sale de `Content-Disposition`; es
 * `null` si el navegador no deja leerlo (el CORS del backend no lo expone en
 * peticiones entre orígenes), y quien llama arma el nombre de respaldo.
 *
 * Lanza `ErrorApi` en cada fallo: con `estado`, `codigo` y `detalles` si el
 * backend respondió con su JSON de error; `error_red` si no hubo conexión; y
 * `respuesta_invalida` si responde 200 pero no es un Excel (otro tipo de
 * contenido o cuerpo vacío), para no guardar un archivo corrupto.
 */
async function descargarExcel(ruta) {
  const headers = { Accept: `${TIPO_XLSX}, application/json;q=0.9` };

  const token = obtenerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let respuesta;

  try {
    respuesta = await fetch(`${BASE}${ruta}`, { method: "GET", headers });
  } catch {
    throw new ErrorApi("No se pudo conectar con el servidor.", {
      codigo: "error_red",
      detalles: {},
    });
  }

  if (!respuesta.ok) {
    let datos = null;
    try {
      datos = JSON.parse(await respuesta.text());
    } catch {
      datos = null;
    }
    throw new ErrorApi(datos?.mensaje ?? "No se pudo completar la solicitud.", {
      estado: respuesta.status,
      codigo: datos?.codigo,
      detalles: datos?.detalles,
    });
  }

  const tipo = respuesta.headers.get("Content-Type") ?? "";
  if (!tipo.toLowerCase().includes("spreadsheetml")) {
    throw new ErrorApi("La respuesta del servidor no es un archivo de Excel.", {
      estado: respuesta.status,
      codigo: "respuesta_invalida",
    });
  }

  let blob;
  try {
    blob = await respuesta.blob();
  } catch {
    throw new ErrorApi("No se pudo conectar con el servidor.", {
      codigo: "error_red",
      detalles: {},
    });
  }
  if (blob.size === 0) {
    throw new ErrorApi("El archivo recibido está vacío.", {
      estado: respuesta.status,
      codigo: "respuesta_invalida",
    });
  }

  return {
    blob,
    nombre: nombreDeContentDisposition(
      respuesta.headers.get("Content-Disposition"),
    ),
  };
}

export const api = {
  /**
   * HU-01/CA-1, CA-2. Crea un corte en estado BORRADOR.
   *
   * `fechaCorte` viaja como `fecha_corte` porque así lo declara el DTO
   * `CorteEntrada` del backend (cortes/api/router.py). Formato "YYYY-MM-DD".
   * Una fecha futura no se valida aquí: el dominio la rechaza con un 422 que
   * trae `detalles.fecha_corte` y `detalles.hoy`.
   */
  crearCorte: (vigencia, fechaCorte) =>
    solicitar("/api/v1/cortes", {
      metodo: "POST",
      cuerpo: { vigencia, fecha_corte: fechaCorte },
    }),

  /** HU-01/CA-8. Histórico completo de cortes. */
  listarCortes: () => solicitar("/api/v1/cortes"),

  /**
   * HU-01/CA-8. Detalle de un corte. Un id inexistente devuelve 404 con
   * `codigo: "recurso_no_encontrado"`.
   *
   * [E02-HU05] Además de `id`, `vigencia`, `fecha_corte` y `estado`, trae
   * `es_corte_actual` (calculado por el backend) y, en cada elemento de
   * `archivos`, `nombre_archivo` y `fecha_carga`. No trae el usuario que
   * cargó cada fuente.
   */
  obtenerCorte: (id) => solicitar(`/api/v1/cortes/${id}`),

  /**
   * HU-01/CA-3, CA-4. Transición BORRADOR -> REGISTRADO.
   *
   * `POST /cortes/{id}/registrar` -- el endpoint ya existe (expuesto sobre
   * `Corte.registrar()`/`ServicioCortes.registrar_corte()`, ya implementados
   * y probados). 409 con `detalles.archivos_faltantes` si falta alguna de
   * las tres fuentes; 404 si el corte no existe.
   */
  registrarCorte: (id) =>
    solicitar(`/api/v1/cortes/${id}/registrar`, { metodo: "POST" }),

  /**
   * HU-02/CA-1, HU-03/CA-1, HU-04/CA-1: sube el archivo fuente `tipo` para
   * `corteId`. `POST /cortes/{corteId}/archivos/{tipo}` -- el endpoint ya
   * existe y esta probado para los 3 tipos (PDT/EJECUCION/PROYECTOS,
   * `test_router_cortes.py`); esta funcion reemplaza el TODO que decia
   * "bloqueado" (verificado 2026-09-20, backend ya cierra de punta a punta).
   *
   * 201 con `{ tipo, nombre_archivo, filas_reconocidas, descartes }`
   * (`ArchivoFuenteRespuestaParcial`, forma provisional -- todavia no incluye
   * `advertencias` a nivel de fila, solo el conteo total). 422 con
   * `codigo: "archivo_invalido"` y `detalles.motivo` en
   * `"hoja_no_encontrada"` (pestana/archivo incorrecto, D15) o
   * `"columnas_faltantes"` (con `detalles.columnas_faltantes`). 404/409 si
   * el corte no existe o no esta en BORRADOR.
   */
  cargarArchivo: (corteId, tipo, archivo) =>
    solicitar(`/api/v1/cortes/${corteId}/archivos/${tipo}`, {
      metodo: "POST",
      archivo,
    }),

  /**
   * HU-07/CA-1. Matriz de relación de un corte, paginada.
   *
   * `GET /matriz-relacion/{corteId}` ([HU-07][FE-01], montado en main.py).
   * 404 con `codigo: "recurso_no_encontrado"` si el corte no existe. 409 con
   * `detalles.archivos_faltantes` si falta alguna de las tres fuentes.
   *
   * `estadoCruce`/`busqueda` (agregados 2026-09-23): filtros de la matriz —
   * ver `trazabilidad/persistence/consultas.py::construir_matriz`.
   * `estadoCruce` es uno de "completo"/"sin_proyecto"/"sin_ejecucion"/
   * "sin_contrato"/"sin_cruce", o `null` para no filtrar.
   *
   * `filtros` (HU-10/CA-2, CA-4 a CA-9, CA-16): objeto con arreglos de
   * valores por criterio, con las claves de `CLAVES_FILTRO_MATRIZ`
   * (`bpin`, `cod_indicador_producto`, `producto`, `numero_contrato`,
   * `sector`, `programa`). Cada valor viaja como un query param repetido
   * (`?bpin=a&bpin=b`): OR dentro de un criterio, AND entre criterios
   * distintos (lo resuelve el backend). Las claves ausentes o con un
   * arreglo vacío no se envían. Los valores se mandan tal cual vienen de
   * `opcionesFiltro` -- el backend compara exacto. OJO: `producto` filtra
   * por `nombre_producto`, no por un código.
   */
  matriz: (
    corteId,
    pagina = 1,
    tamanoPagina = 50,
    estadoCruce = null,
    busqueda = null,
    filtros = {},
  ) => {
    const parametros = new URLSearchParams({
      pagina: String(pagina),
      tamano_pagina: String(tamanoPagina),
    });
    if (estadoCruce) parametros.set("estado_cruce", estadoCruce);
    if (busqueda) parametros.set("busqueda", busqueda);
    for (const clave of CLAVES_FILTRO_MATRIZ) {
      for (const valor of filtros?.[clave] ?? []) {
        parametros.append(clave, valor);
      }
    }
    return solicitar(`/api/v1/matriz-relacion/${corteId}?${parametros}`);
  },

  /**
   * HU-10/CA-1, CA-3. Valores disponibles por criterio para el corte.
   *
   * `GET /matriz-relacion/{corteId}/opciones-filtro`. Mismos 404
   * (`recurso_no_encontrado`) y 409 (`operacion_no_permitida`, con
   * `detalles.archivos_faltantes`) que `matriz`, y 401 sin sesión (exige
   * autenticación desde el fix E01-HU02, #150; el token lo adjunta
   * `solicitar`). Responde:
   *
   *     {
   *       bpin: string[],
   *       indicadores: { codigo: string, nombre: string | null }[],
   *       productos: string[],
   *       contratos: string[],
   *       sectores: string[],
   *       programas: string[],
   *     }
   *
   * LOS NOMBRES DE ESTAS LISTAS NO COINCIDEN con las claves de filtro de
   * `matriz`: `indicadores` -> `cod_indicador_producto` (se envía el
   * `codigo`), `productos` -> `producto`, `contratos` -> `numero_contrato`,
   * `sectores` -> `sector`, `programas` -> `programa`; `bpin` -> `bpin`.
   * El autocompletado de BPIN y contrato (CA-3) es del cliente, sobre estas
   * mismas listas: no existe un endpoint de autocompletado.
   */
  opcionesFiltro: (corteId) =>
    solicitar(`/api/v1/matriz-relacion/${corteId}/opciones-filtro`),

  /**
   * [E02-HU05/CA-2] Reemplaza el archivo de `tipo` en el corte actual ya
   * Registrado.
   *
   * `POST /cortes/{corteId}/archivos/{tipo}/reemplazo` (multipart, campo
   * `archivo`) — a propósito una ruta distinta de `cargarArchivo`
   * (`POST /cortes/{id}/archivos/{tipo}`), que [E02-HU06] bloquea con 409
   * para cualquier corte Registrado (`Corte.verificar_modificable`). Exige
   * administrador o gestor.
   *
   * Un solo endpoint valida y aplica, y revierte todo si algo falla
   * (Opción B, D25 en docs/DECISIONES.md): no existe un paso de "validar sin
   * aplicar", así que la confirmación (CA-3) se pide ANTES de llamarlo.
   *
   * 200 con `{ tipo, nombre_archivo, filas_reconocidas, codigos, descartes,
   * metas_eliminadas }` (`ArchivoFuenteRespuestaParcial`; no trae
   * `fecha_carga`). `metas_eliminadas` ([E02-HU05/CA-7]) es la lista de
   * códigos de meta que el corte tenía y el PDT nuevo ya no trae; `[]` para
   * las otras fuentes. Errores, todos
   * con `{ codigo, mensaje, detalles }`: 403 `permiso_insuficiente`
   * (visitante); 404 `recurso_no_encontrado`; 409 `operacion_no_permitida`
   * con `detalles.motivo` en `"corte_no_registrado"` (sigue en BORRADOR) o
   * `"corte_no_es_el_actual"` (CA-5); 422 `archivo_invalido` con
   * `detalles.motivo`, igual que `cargarArchivo` (CA-4).
   */
  reemplazarArchivoCorteActual: (corteId, tipo, archivo) =>
    solicitar(`/api/v1/cortes/${corteId}/archivos/${tipo}/reemplazo`, {
      metodo: "POST",
      archivo,
    }),

  /**
   * [E02-HU05/CA-6] Historial de reemplazos de archivos del corte.
   *
   * `GET /cortes/{corteId}/historial`, abierto a cualquier rol autenticado.
   * Responde una lista de entradas
   * `{ id, tipo, nombre_archivo_anterior, nombre_archivo_nuevo, usuario, fecha_hora }`;
   * `nombre_archivo_anterior` es `null` si el corte no tenía archivo de esa
   * fuente. 404 `recurso_no_encontrado` si el corte no existe. El archivo
   * `.xlsx` anterior no se conserva (decisión cerrada, D25) — solo este
   * registro.
   */
  historialCorte: (corteId) => solicitar(`/api/v1/cortes/${corteId}/historial`),

  /**
   * [E04-HU01] Plan de Acción consolidado del corte REGISTRADO más reciente.
   *
   * `GET /plan-accion/actual`, solo para `administrador` y `visitante`
   * (D26): un `gestor` recibe 403. Responde
   *
   *     {
   *       corte_id, vigencia, fecha_corte: "YYYY-MM-DD",
   *       filas: [{
   *         sector, cod_indicador_producto, nombre_producto, meta_programada,
   *         cod_bpin, rubros: string[], presupuesto_definitivo, ejecucion,
   *         contratos: string[], avance_fisico_pct, avance_financiero_pct,
   *         estado_cruce: "completo" | "parcial" | "sin_informacion",
   *       }],
   *       resumen: { total, completo, parcial, sin_informacion },
   *     }
   *
   * Una fila por meta, ordenada por `cod_indicador_producto`. Los montos, la
   * meta programada y los porcentajes llegan como TEXTO (Decimal del
   * backend): convertir con `Number()` antes de formatear. Cualquier campo
   * salvo `cod_indicador_producto` y `estado_cruce` puede ser `null`, y
   * `rubros`/`contratos` pueden ser `[]`. `avance_fisico_pct` es siempre
   * `null` hasta que exista E-03.
   *
   * Errores, todos con `{ codigo, mensaje, detalles }`: 401
   * `credenciales_invalidas`; 403 `permiso_insuficiente`; 404
   * `recurso_no_encontrado` (ningún corte REGISTRADO); 409
   * `operacion_no_permitida` con `detalles.archivos_faltantes` (al corte
   * actual le falta alguna fuente).
   *
   * Todavía sin filtros: el endpoint acepta `sector`, `estado_cruce`,
   * `busqueda` y `cod_indicador_producto` (E04-HU02), que esta función no usa.
   */
  planAccionActual: () => solicitar("/api/v1/plan-accion/actual"),

  /**
   * [E04-HU03] `GET /api/v1/plan-accion/exportar`: el Plan de Acción como
   * `.xlsx`. `consulta` es el query string de los filtros
   * (`consultaDeFiltros`, lib/filtrosPlanAccion.js; `""` exporta todo): los
   * mismos query params que `/actual`. Devuelve `{ blob, nombre }`; `nombre`
   * es `null` si el navegador no expone `Content-Disposition` (ver
   * `descargarExcel`).
   *
   * Errores (`ErrorApi`): 401 `credenciales_invalidas`; 403
   * `permiso_insuficiente`; 404 `recurso_no_encontrado` (ningún corte
   * REGISTRADO); 409 `operacion_no_permitida` con
   * `detalles.archivos_faltantes`; `error_red`; y `respuesta_invalida` si
   * la respuesta no es un Excel.
   */
  exportarPlanAccion: (consulta = "") =>
    descargarExcel(
      `/api/v1/plan-accion/exportar${consulta ? `?${consulta}` : ""}`,
    ),
};
