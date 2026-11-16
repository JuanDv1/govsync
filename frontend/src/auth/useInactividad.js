/**
 * Detecta inactividad de la persona ([E-01/HU-01] CA04).
 *
 * "Actividad" es input real (mouse, teclado, scroll, toque). Las peticiones
 * en segundo plano y la renovación automática del token (`onTokenExpired` →
 * `updateToken`) NO cuentan: sin esa distinción la sesión nunca vencería con
 * la pestaña abierta.
 *
 * Varias pestañas: `keycloak.logout` cierra la sesión SSO de TODAS, así que
 * la inactividad se mide entre todas. La hora de la última actividad vive en
 * `localStorage` (compartido por las pestañas del mismo origen): cada pestaña
 * la actualiza al detectar input y la lee al revisar. Una pestaña olvidada en
 * segundo plano no cierra la sesión mientras se trabaje en otra.
 *
 * Se compara contra esa hora con un intervalo corto, no con un único
 * `setTimeout` de 30 min: los navegadores atrasan los timers de pestañas en
 * segundo plano y de equipos suspendidos, y así igual se detecta el
 * vencimiento apenas la pestaña vuelve a despertar.
 *
 * Si `localStorage` no está disponible (modo privado, bloqueado), se cae a la
 * última actividad de esta pestaña: el límite sigue aplicando, solo sin
 * compartirse.
 *
 * Este cierre es del CLIENTE: mientras haya una pestaña abierta, la renovación
 * automática del token renueva también la inactividad SSO de Keycloak
 * (`ssoSessionIdleTimeout` = 1800 s), así que el límite del servidor solo
 * aplica si no hay renovaciones. No es defensa en profundidad.
 */
import { useEffect, useRef } from "react";

export const INACTIVIDAD_MS = 30 * 60 * 1000;
export const CLAVE_ULTIMA_ACTIVIDAD = "govsync.ultimaActividad";
const REVISION_MS = 10 * 1000;
//: Un mousemove dispara decenas de eventos por segundo: se escribe a
//: `localStorage` como mucho una vez por segundo.
const ESCRITURA_MIN_MS = 1000;
const EVENTOS_ACTIVIDAD = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

function leerCompartida() {
  try {
    const valor = Number(window.localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD));
    return Number.isFinite(valor) && valor > 0 ? valor : 0;
  } catch {
    return 0;
  }
}

function escribirCompartida(hora) {
  try {
    window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(hora));
  } catch {
    // Sin almacenamiento: queda solo la actividad de esta pestaña.
  }
}

function borrarCompartida() {
  try {
    window.localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
  } catch {
    // Nada que limpiar.
  }
}

/**
 * @param {boolean} activo      Solo vigila mientras hay sesión.
 * @param {() => void} alInactivo Se llama una vez al cumplirse el límite.
 * @param {number} limiteMs     Parametrizable para pruebas.
 */
export function useInactividad(activo, alInactivo, limiteMs = INACTIVIDAD_MS) {
  // Ref: el callback puede cambiar entre renders sin reiniciar la vigilancia.
  const alInactivoRef = useRef(alInactivo);
  useEffect(() => {
    alInactivoRef.current = alInactivo;
  }, [alInactivo]);

  useEffect(() => {
    if (!activo) return undefined;

    let ultimaLocal = Date.now();
    let ultimaEscritura = ultimaLocal;
    let disparado = false;
    // Iniciar la vigilancia cuenta como actividad (acaba de iniciar sesión) y
    // evita heredar la hora de una sesión anterior ya vencida.
    escribirCompartida(ultimaLocal);

    const registrar = () => {
      const ahora = Date.now();
      ultimaLocal = ahora;
      if (ahora - ultimaEscritura >= ESCRITURA_MIN_MS) {
        ultimaEscritura = ahora;
        escribirCompartida(ahora);
      }
    };
    EVENTOS_ACTIVIDAD.forEach((evento) =>
      window.addEventListener(evento, registrar, { passive: true }),
    );

    const revisar = () => {
      if (disparado) return;
      const ahora = Date.now();
      // Reloj atrasado: la última actividad local quedaría en el futuro y
      // aplazaría el cierre; se toma como actividad ahora y cuenta desde ahí.
      if (ultimaLocal > ahora) ultimaLocal = ahora;
      // Una hora compartida en el futuro (reloj movido, dato adulterado) se
      // ignora: si no, aplazaría el vencimiento indefinidamente.
      const compartida = leerCompartida();
      const ultima = Math.max(
        ultimaLocal,
        compartida <= ahora ? compartida : 0,
      );
      if (ahora - ultima >= limiteMs) {
        disparado = true;
        // Si el cierre falla (red, Keycloak caído) se reintenta en la
        // siguiente revisión: la sesión no puede quedar abierta pasado el límite.
        const reintentar = () => {
          disparado = false;
        };
        try {
          Promise.resolve(alInactivoRef.current()).catch(reintentar);
        } catch {
          reintentar();
        }
      }
    };
    const intervalo = setInterval(revisar, REVISION_MS);
    // Al volver a la pestaña no hay que esperar al siguiente intervalo.
    document.addEventListener("visibilitychange", revisar);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", revisar);
      EVENTOS_ACTIVIDAD.forEach((evento) =>
        window.removeEventListener(evento, registrar),
      );
      // Sin sesión no hay actividad que compartir. Si otra pestaña sigue
      // vigilando, reescribe su hora en su próxima actividad.
      borrarCompartida();
    };
  }, [activo, limiteMs]);
}
