/**
 * Prueba de carga (k6) del módulo Plan de Acción.
 *
 * TARJETA: entregable Sprint 3 -- "Diseño de Pruebas y Rendimiento"
 * (ver sprint3_entrega_final.pdf). Mide los 3 endpoints de lectura de
 * [E04-HU01]/[E04-HU02]/[E04-HU04] -- el módulo que el equipo marcó como
 * prioritario para refinar en este sprint.
 *
 * ================================================================
 * POR QUÉ ESTE SCRIPT NO CORRE SOLO EN CI TODAVÍA (leer antes de usar)
 * ================================================================
 * Los 3 endpoints exigen un JWT válido (`exigir_roles`, ver
 * `app/core/dependencias.py`). El job `backend-keycloak` de
 * `.github/workflows/ci.yml` SOLO levanta un Keycloak vacío para probar que
 * la imagen arranca (ver su propio comentario: "no crea realm/cliente/rol
 * ni valida un token real -- eso es una tarjeta siguiente"). Mientras esa
 * tarjeta no exista, no hay ninguna forma automática de conseguir un token
 * válido dentro de un runner de GitHub Actions efímero -- inventar una
 * aquí sería fabricar un supuesto de seguridad no verificado (CONTRARIO a
 * "nunca conviertas una suposición en un requisito").
 *
 * Por eso este script:
 *   1. Corre MANUALMENTE (o en un job de CI separado, disparado a mano
 *      con `workflow_dispatch`, ver `.github/workflows/perf.yml`) contra un
 *      backend YA corriendo (local o un ambiente de staging real), nunca
 *      contra el runner de CI de cada PR.
 *   2. Recibe el token por variable de entorno (`K6_TOKEN`), obtenido por
 *      quien lo ejecuta iniciando sesión de verdad contra Keycloak (nunca
 *      hardcodeado ni generado por este script).
 *
 * ================================================================
 * USO
 * ================================================================
 *   BASE_URL=http://localhost:8000 K6_TOKEN="<jwt>" k6 run tests/perf/k6_plan_accion.js
 *
 * Variables de entorno:
 *   BASE_URL   (default: http://localhost:8000) -- sin "/api/v1" al final.
 *   K6_TOKEN   (obligatoria) -- JWT Bearer de un usuario con rol
 *              administrador o visitante (CA10 de [E04-HU01]).
 *   VUS        (default: 10) -- usuarios virtuales concurrentes.
 *   DURATION   (default: 30s).
 *
 * Qué mide (3 escenarios, con pesos distintos porque no se usan igual en
 * producción -- `/actual` es el que carga cada vez que alguien abre la
 * pantalla; `/exportar` y `/comparar` son acciones puntuales del usuario):
 *   - GET /plan-accion/actual     (70% del tráfico simulado)
 *   - GET /plan-accion/exportar   (15%, genera un .xlsx real cada vez)
 *   - GET /plan-accion/comparar   (15%, necesita 2 cortes -- ver
 *     `obtenerParDeCortes()`; si la vigencia configurada no tiene al menos
 *     2 cortes REGISTRADO, este escenario se salta solo y lo reporta, no
 *     inventa ids).
 *
 * UMBRALES (`thresholds`): fallan la ejecución (exit code != 0) si no se
 * cumplen -- pensados para una pantalla que un humano espera ver cargar,
 * no para un límite de SLA productivo todavía sin definir por el equipo
 * (PENDIENTE -- ver propuesta de DevOps, "ambigüedades").
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = `${__ENV.BASE_URL || "http://localhost:8000"}/api/v1`;
const TOKEN = __ENV.K6_TOKEN;
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || "30s";

if (!TOKEN) {
  throw new Error(
    "Falta la variable de entorno K6_TOKEN (JWT Bearer). Ver el " +
      "docstring de este archivo -- este script NUNCA genera ni asume un " +
      "token: debe venir de un login real contra Keycloak.",
  );
}

const headers = { Authorization: `Bearer ${TOKEN}` };

export const options = {
  scenarios: {
    plan_accion_actual: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      exec: "verActual",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // menos del 1% de errores HTTP
    "http_req_duration{endpoint:actual}": ["p(95)<1500"],
    "http_req_duration{endpoint:exportar}": ["p(95)<3000"],
    "http_req_duration{endpoint:comparar}": ["p(95)<2000"],
  },
};

const erroresComparar = new Rate("errores_comparar");
const duracionComparar = new Trend("duracion_comparar");

let parDeCortesCache = null;

/** CA01/CA02 de [E04-HU04]: necesita una vigencia con >= 2 cortes
 * REGISTRADO. Se resuelve UNA vez (no en cada iteración) iterando las
 * vigencias más probables -- si ninguna tiene 2 cortes, el escenario de
 * "comparar" se reporta como saltado, nunca se inventa un id de corte. */
function obtenerParDeCortes() {
  if (parDeCortesCache !== null) return parDeCortesCache;

  for (const vigencia of [2024, 2025, 2026]) {
    const resp = http.get(`${BASE_URL}/plan-accion/cortes-disponibles?vigencia=${vigencia}`, {
      headers,
      tags: { endpoint: "cortes_disponibles" },
    });
    if (resp.status === 200) {
      const cortes = resp.json();
      if (Array.isArray(cortes) && cortes.length >= 2) {
        parDeCortesCache = { id1: cortes[0].id, id2: cortes[1].id };
        return parDeCortesCache;
      }
    }
  }
  parDeCortesCache = false; // no hay par disponible -- no reintentar cada VU
  return parDeCortesCache;
}

export function verActual() {
  const r = Math.random();

  const respActual = http.get(`${BASE_URL}/plan-accion/actual`, {
    headers,
    tags: { endpoint: "actual" },
  });
  check(respActual, {
    "/actual responde 200": (resp) => resp.status === 200,
  });

  if (r < 0.15) {
    const respExportar = http.get(`${BASE_URL}/plan-accion/exportar`, {
      headers,
      tags: { endpoint: "exportar" },
    });
    check(respExportar, {
      "/exportar responde 200": (resp) => resp.status === 200,
      "/exportar devuelve xlsx": (resp) =>
        (resp.headers["Content-Type"] || "").includes("spreadsheetml"),
    });
  } else if (r < 0.3) {
    const par = obtenerParDeCortes();
    if (par) {
      const respComparar = http.get(
        `${BASE_URL}/plan-accion/comparar?corte_id_1=${par.id1}&corte_id_2=${par.id2}`,
        { headers, tags: { endpoint: "comparar" } },
      );
      const ok = check(respComparar, {
        "/comparar responde 200": (resp) => resp.status === 200,
      });
      erroresComparar.add(!ok);
      duracionComparar.add(respComparar.timings.duration);
    }
  }

  sleep(1); // simula el tiempo de lectura de un usuario real, no ráfaga pura
}
