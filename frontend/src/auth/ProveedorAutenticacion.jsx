/**
 * Contexto de autenticación ([HU-E01-01], docs/DECISIONES.md D23/D24).
 *
 * Inicializa Keycloak UNA VEZ para toda la app y expone a los componentes
 * si hay sesión activa, el usuario (nombre/correo/roles) y las acciones de
 * iniciar/cerrar sesión. También conecta el token con `api/cliente.js`
 * (`establecerProveedorToken`), para que cada petición HTTP lo adjunte sin
 * que cada pantalla tenga que pasarlo a mano.
 *
 * SILENT-CHECK-SSO: `onLoad: "check-sso"` + `silentCheckSsoRedirectUri`
 * (apunta a `public/silent-check-sso.html`) hacen que, al recargar la
 * página, keycloak-js verifique en un iframe oculto si la sesión de
 * Keycloak sigue activa — sin eso, cada recarga perdía el estado de
 * autenticación en memoria y mostraba `Login.jsx` aunque la sesión de
 * Keycloak siguiera viva (hallazgo real de prueba manual, 2026-10-10:
 * además de ese parpadeo, hacía que "Ingresar" pareciera entrar solo, sin
 * pedir nada, porque la sesión de Keycloak igual estaba activa — ambos
 * síntomas eran la misma causa).
 *
 * `checkLoginIframe: false`: sin monitoreo PERIÓDICO de sesión activa
 * (distinto del chequeo de arriba, que solo corre una vez al cargar) —
 * depende de cookies de terceros, no se verificó contra un Keycloak real.
 * Si el admin cierra la sesión desde Keycloak, esta pestaña no se entera
 * hasta que el token expire y falle un refresh.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import keycloak from "./keycloak.js";
import { establecerProveedorToken } from "../api/cliente.js";
import {
  puedeEscribir,
  puedeVerPlanAccion,
  tieneSoloRolesSinModulos,
} from "./roles.js";

const ContextoAutenticacion = createContext(null);

//: Las listas de roles (D24, D26, D37) viven en `roles.js`, sin React, para
//: poder probarlas y no repetirlas en cada pantalla. Solo deciden qué se
//: muestra: el backend rechaza con 403 de todas formas.

export function ProveedorAutenticacion({ children }) {
  const [cargando, setCargando] = useState(true);
  const [estaAutenticado, setEstaAutenticado] = useState(false);
  const yaInicializado = useRef(false);

  useEffect(() => {
    // React.StrictMode (main.jsx) invoca los efectos dos veces en
    // desarrollo — keycloak.init() no es idempotente, así que sin esta
    // guarda se dispararía dos veces.
    if (yaInicializado.current) return;
    yaInicializado.current = true;

    establecerProveedorToken(() => keycloak.token ?? null);

    keycloak.onAuthLogout = () => setEstaAutenticado(false);
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.clearToken());
    };

    keycloak
      .init({
        pkceMethod: "S256",
        checkLoginIframe: false,
        onLoad: "check-sso",
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      })
      .then((autenticado) => setEstaAutenticado(autenticado))
      .catch(() => setEstaAutenticado(false))
      .finally(() => setCargando(false));
  }, []);

  // useMemo: el objeto de contexto no debe cambiar en cada render — si no,
  // cada componente que consume useAutenticacion() se re-renderiza de más
  // (hallazgo de SonarCloud, javascript:S6481). Depende solo de estado real
  // (cargando/estaAutenticado); keycloak.tokenParsed/realmAccess no son
  // estado de React, pero solo cambian junto con estaAutenticado.
  const valor = useMemo(() => {
    const usuario = estaAutenticado
      ? {
          nombre: keycloak.tokenParsed?.preferred_username ?? null,
          correo: keycloak.tokenParsed?.email ?? null,
          roles: keycloak.realmAccess?.roles ?? [],
        }
      : null;

    return {
      cargando,
      estaAutenticado,
      usuario,
      puedeEscribir: puedeEscribir(usuario?.roles),
      puedeVerPlanAccion: puedeVerPlanAccion(usuario?.roles),
      // D37: rol válido pero sin módulos en esta versión (hoy, gestor).
      rolSinModulos: tieneSoloRolesSinModulos(usuario?.roles),
      iniciarSesion: () =>
        keycloak.login({ redirectUri: `${window.location.origin}/cortes` }),
      cerrarSesion: () =>
        keycloak.logout({ redirectUri: `${window.location.origin}/login` }),
    };
  }, [cargando, estaAutenticado]);

  return (
    <ContextoAutenticacion.Provider value={valor}>
      {children}
    </ContextoAutenticacion.Provider>
  );
}

export function useAutenticacion() {
  const contexto = useContext(ContextoAutenticacion);
  if (!contexto) {
    throw new Error(
      "useAutenticacion debe usarse dentro de <ProveedorAutenticacion>.",
    );
  }
  return contexto;
}
