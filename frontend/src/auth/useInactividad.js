/**
 * Detecta inactividad de la persona ([E-01/HU-01] CA04).
 *
 * "Actividad" es input real (mouse, teclado, scroll, toque). Las peticiones
 * en segundo plano y la renovación automática del token (`onTokenExpired` →
 * `updateToken`) NO cuentan: sin esa distinción la sesión nunca vencería con
 * la pestaña abierta.
 *
 * Se compara contra la hora de la última actividad con un intervalo corto, no
 * con un único `setTimeout` de 30 min: los navegadores atrasan los timers de
 * pestañas en segundo plano y de equipos suspendidos, y así igual se detecta
 * el vencimiento apenas la pestaña vuelve a despertar.
 *
 * Alcance: solo esta pestaña. Con varias pestañas abiertas, cada una cuenta
 * su propia inactividad (el límite real lo impone Keycloak, 1800 s en el
 * realm).
 */
import { useEffect, useRef } from "react";

export const INACTIVIDAD_MS = 30 * 60 * 1000;
const REVISION_MS = 10 * 1000;
const EVENTOS_ACTIVIDAD = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

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

    let ultimaActividad = Date.now();
    let disparado = false;
    const registrar = () => {
      ultimaActividad = Date.now();
    };
    EVENTOS_ACTIVIDAD.forEach((evento) =>
      window.addEventListener(evento, registrar, { passive: true }),
    );

    const revisar = () => {
      if (!disparado && Date.now() - ultimaActividad >= limiteMs) {
        disparado = true;
        alInactivoRef.current();
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
    };
  }, [activo, limiteMs]);
}
