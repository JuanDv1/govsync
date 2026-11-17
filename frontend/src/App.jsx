/**
 * Enrutamiento de la aplicación.
 *
 * TARJETA: [UX-01] Layout base, enrutamiento y cliente HTTP
 *
 * Las rutas se agregan a medida que existen sus pantallas. Mientras tanto se
 * muestra un marcador de posición: así `npm run dev` arranca y confirma que la
 * cadena de herramientas funciona, sin fingir que la pantalla ya está hecha.
 */
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import NuevoCorte from "./pages/NuevoCorte.jsx";
import Cortes from "./pages/Cortes.jsx";
import EditarArchivosCorteActual from "./pages/EditarArchivosCorteActual.jsx";
import Login from "./pages/Login.jsx";

import Disposicion from "./components/Disposicion.jsx";
import MatrizRelacion from "./pages/MatrizRelacion.jsx";
import PlanAccion from "./pages/PlanAccion.jsx";
import PlanAccionPublico from "./pages/PlanAccionPublico.jsx";
import CompararCortes from "./pages/CompararCortes.jsx";
import { Vacio } from "./components/Estados.jsx";
import Card from "./components/shared/Card.jsx";
import PantallaSinAcceso from "./components/shared/PantallaSinAcceso.jsx";
import { useAutenticacion } from "./auth/ProveedorAutenticacion.jsx";
import { puedeAbrirRuta } from "./auth/roles.js";

/** [HU-E01-01] / D23/D24: exige sesión de Keycloak activa antes de montar
 * las rutas que envuelve. `cargando` cubre la ventana entre que la app
 * arranca y `keycloak.init()` resuelve — sin esto, un usuario SIN sesión
 * vería un parpadeo de contenido protegido antes del redirect. */
function RutaProtegida({ children }) {
  const {
    cargando,
    estaAutenticado,
    usuario,
    motivoSinAcceso,
    vistaInicial,
    loginReciente,
    finalizarLoginReciente,
  } = useAutenticacion();
  const location = useLocation();

  // CA07: la marca vale para una sola carga; al consumirla, navegar después
  // (links, "/" → vista inicial) no vuelve a redirigir. Se consume solo cuando
  // `cargando` ya es false: es entonces cuando el render la usa para decidir.
  useEffect(() => {
    if (loginReciente && !cargando) finalizarLoginReciente();
  }, [loginReciente, cargando, finalizarLoginReciente]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-campo text-gray-600">
        Verificando sesión…
      </div>
    );
  }

  if (!estaAutenticado) {
    // [E-01/HU-01] CA07: se recuerda la ruta pedida para volver tras el login.
    return (
      <Navigate
        to="/login"
        replace
        state={{ desde: location.pathname + location.search }}
      />
    );
  }

  // [E-01/HU-01] CA05 / D37: sesión válida que no puede usar ningún módulo.
  // Reemplaza TODO el layout, también al entrar por URL directa a cualquier
  // ruta interna: no se monta ningún módulo ni se dispara ninguna petición. El
  // backend responde 403 a esas cuentas de todas formas.
  if (motivoSinAcceso === "sin_rol") {
    return (
      <PantallaSinAcceso
        titulo="Su cuenta no tiene un rol asignado"
        descripcion="Contacte a la administradora"
      />
    );
  }
  if (motivoSinAcceso === "rol_sin_modulos") {
    return (
      <PantallaSinAcceso
        titulo="Su rol no tiene módulos habilitados en esta versión"
        descripcion="Su cuenta está activa, pero su rol todavía no tiene funciones disponibles en GovSync. Si necesita acceso, contacte a la administradora."
      />
    );
  }

  // [E-01/HU-01] CA07: recién iniciada la sesión, la URL original solo se
  // respeta si el rol tiene permiso; si no, va a su vista inicial (CA01).
  // Con la sesión ya abierta, una URL sin permiso sigue mostrando el aviso del
  // módulo (E04-HU01/CA10).
  if (loginReciente && !puedeAbrirRuta(location.pathname, usuario.roles)) {
    return <Navigate to={vistaInicial} replace />;
  }

  return children;
}

/** [E04-HU01/CA10] / D26: el Plan de Acción solo lo ven `administrador` y
 * `visitante`. Sin ese rol, el acceso por URL directa muestra el aviso de
 * permiso y NO monta la pantalla, así que tampoco se dispara la petición.
 * Es solo UI: el backend ya responde 403 a los demás roles. Va dentro de
 * `RutaProtegida`, que ya garantiza que hay sesión. */
function RutaConPlanAccion({ children }) {
  const { puedeVerPlanAccion } = useAutenticacion();

  if (!puedeVerPlanAccion) {
    return (
      <section className="mx-auto max-w-4xl">
        <Vacio
          titulo="No tiene permiso para ver el Plan de Acción"
          descripcion="Su rol no tiene acceso a este módulo."
        />
      </section>
    );
  }

  return children;
}

/** [E-01/HU-01] CA01: "/" lleva a la vista inicial del rol. Va dentro de
 * `RutaProtegida`, así que aquí el rol ya tiene al menos un módulo. */
function VistaInicial() {
  const { vistaInicial } = useAutenticacion();
  return <Navigate to={vistaInicial} replace />;
}

function Pendiente() {
  return (
    <Card as="section" className="mx-auto max-w-2xl">
      <h1 className="text-cuerpo font-semibold text-gray-800">GovSync</h1>
      <p className="mt-1 text-campo text-gray-600">
        Esqueleto del Sprint 1. Las pantallas se implementan según{" "}
        <code className="font-mono">PLAN-DE-TRABAJO.md</code>.
      </p>
      <p className="mt-2 text-campo text-gray-600">
        Backend:{" "}
        <a
          href="http://localhost:8000/docs"
          className="font-medium text-azul hover:text-navy"
        >
          http://localhost:8000/docs
        </a>
      </p>
    </Card>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* [E-01/HU-01] Consulta pública del Plan de Acción: FUERA de
          `RutaProtegida` a propósito. Sin sesión, sin menú de módulos y sin
          `Authorization`; el endpoint del backend es público. */}
      <Route path="/publico/plan-accion" element={<PlanAccionPublico />} />

      <Route
        element={
          <RutaProtegida>
            <Disposicion />
          </RutaProtegida>
        }
      >
        <Route path="/" element={<VistaInicial />} />
        <Route path="/cortes" element={<Cortes />} />
        <Route path="/cortes/nuevo" element={<NuevoCorte />} />
        {/* Reanudar un corte en BORRADOR — ver docstring de NuevoCorte.jsx.
            React Router prioriza los segmentos estáticos ("/cortes/nuevo")
            sobre los dinámicos, así que el orden de estas dos rutas no
            importa para que no choquen entre sí. */}
        <Route path="/cortes/:corteId" element={<NuevoCorte />} />
        {/* [E02-HU05] Editar archivos del corte actual, ya REGISTRADO —
            distinta de "/cortes/:corteId" (reanudar un BORRADOR, arriba). */}
        <Route
          path="/cortes/:corteId/editar"
          element={<EditarArchivosCorteActual />}
        />
        <Route path="/matriz/:corteId?" element={<MatrizRelacion />} />
        {/* [E04-HU01] Plan de Acción consolidado del corte actual. */}
        <Route
          path="/plan-accion"
          element={
            <RutaConPlanAccion>
              <PlanAccion />
            </RutaConPlanAccion>
          }
        />
        {/* [E04-HU04] Comparación entre dos cortes de una vigencia
            (`?vigencia=N`); mismo permiso que el Plan de Acción. */}
        <Route
          path="/plan-accion/comparar"
          element={
            <RutaConPlanAccion>
              <CompararCortes />
            </RutaConPlanAccion>
          }
        />
        <Route path="*" element={<Pendiente />} />
      </Route>
    </Routes>
  );
}
