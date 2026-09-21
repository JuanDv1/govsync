/**
 * Layout base de GovSync.
 *
 * TARJETA: [UX-01] Layout base, enrutamiento y cliente HTTP
 *
 * Define la estructura común de navegación y el área donde React Router
 * renderiza cada pantalla.
 */
import { NavLink, Outlet } from "react-router-dom";

const enlaceClase = ({ isActive }) =>
  `rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
    isActive ? "bg-white/10 text-white" : "text-azul-tenue hover:text-white"
  }`;

export default function Disposicion() {
  return (
    <>
      <header className="bg-navy px-6 py-3">
        <nav
          aria-label="Navegación principal"
          className="flex items-center gap-1"
        >
          <NavLink
            to="/"
            end
            className="mr-4 text-sm font-bold tracking-[0.1em] text-white"
          >
            GOV<span className="text-azul-claro">SYNC</span>
          </NavLink>

          <NavLink to="/cortes/nuevo" className={enlaceClase}>
            Crear corte
          </NavLink>
          <NavLink to="/cortes" className={enlaceClase}>
            Cortes
          </NavLink>
          <NavLink to="/matriz" className={enlaceClase}>
            Matriz
          </NavLink>
        </nav>
      </header>

      <main className="min-h-[calc(100vh-49px)] bg-fondo-pagina">
        <Outlet />
      </main>
    </>
  );
}
