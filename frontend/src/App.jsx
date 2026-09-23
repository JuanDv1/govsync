/**
 * Enrutamiento de la aplicación.
 *
 * TARJETA: [UX-01] Layout base, enrutamiento y cliente HTTP
 *
 * Las rutas se agregan a medida que existen sus pantallas. Mientras tanto se
 * muestra un marcador de posición: así `npm run dev` arranca y confirma que la
 * cadena de herramientas funciona, sin fingir que la pantalla ya está hecha.
 */
import { Route, Routes } from "react-router-dom";
import NuevoCorte from "./pages/NuevoCorte.jsx";
import Cortes from "./pages/Cortes.jsx";
import Login from "./pages/Login.jsx";

import Disposicion from "./components/Disposicion.jsx";
import MatrizRelacion from "./pages/MatrizRelacion.jsx";

function Pendiente() {
  return (
    <section className="mx-auto max-w-2xl rounded-sm border border-gray-200 bg-white p-5">
      <h1 className="text-base font-semibold text-gray-800">GovSync</h1>
      <p className="mt-1 text-xs text-gray-500">
        Esqueleto del Sprint 1. Las pantallas se implementan según{" "}
        <code className="font-mono">PLAN-DE-TRABAJO.md</code>.
      </p>
      <p className="mt-2 text-xs text-gray-500">
        Backend:{" "}
        <a
          href="http://localhost:8000/docs"
          className="font-medium text-azul hover:text-navy"
        >
          http://localhost:8000/docs
        </a>
      </p>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Disposicion />}>
        <Route path="/cortes" element={<Cortes />} />
        <Route path="/cortes/nuevo" element={<NuevoCorte />} />
        {/* Reanudar un corte en BORRADOR — ver docstring de NuevoCorte.jsx.
            React Router prioriza los segmentos estáticos ("/cortes/nuevo")
            sobre los dinámicos, así que el orden de estas dos rutas no
            importa para que no choquen entre sí. */}
        <Route path="/cortes/:corteId" element={<NuevoCorte />} />
        <Route path="/matriz/:corteId?" element={<MatrizRelacion />} />
        <Route path="*" element={<Pendiente />} />
      </Route>
    </Routes>
  );
}
