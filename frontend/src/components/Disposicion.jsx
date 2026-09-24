/**
 * Layout base de GovSync — sidebar AppShell.
 *
 * TARJETA: [UX-01] Layout base, enrutamiento y cliente HTTP
 *
 * Adaptado de DESIGN_SPEC.md §4.1. Sin RBAC: ese documento describe un menú
 * filtrado por rol (`NAV_BY_ROLE`), pero la épica de roles/autenticación
 * está deliberadamente fuera de alcance de este sprint (docs/DECISIONES.md
 * D2, [REF-05]) — el menú de abajo es único y fijo, con solo las rutas que
 * ya existen en `App.jsx`. El enlace "Cerrar sesión" navega a `/login` sin
 * lógica de sesión real, mismo criterio que la propia pantalla de Login.
 */
import { LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const enlaceClase = ({ isActive }) =>
  `block rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-azul text-white"
      : "text-azul-tenue hover:bg-navy-sidebar hover:text-white"
  }`;

export default function Disposicion() {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-52 shrink-0 flex-col bg-navy">
        <NavLink to="/cortes" className="border-b border-white/10 p-5">
          <div className="text-lg font-bold tracking-[0.1em] text-white">
            GOV<span className="text-azul-claro">SYNC</span>
          </div>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-azul-tenue">
            Plan de Desarrollo
          </p>
        </NavLink>

        <nav
          aria-label="Navegación principal"
          className="flex flex-1 flex-col gap-1 p-3"
        >
          <NavLink to="/cortes/nuevo" className={enlaceClase}>
            Nuevo corte
          </NavLink>
          {/* `end`: sin esto, NavLink resalta "Cortes" para cualquier ruta
              que empiece con "/cortes" — incluidas "/cortes/nuevo" y
              "/cortes/:id" (reanudar borrador) — y quedaban dos ítems
              del menú resaltados a la vez. */}
          <NavLink to="/cortes" end className={enlaceClase}>
            Cortes
          </NavLink>
          <NavLink to="/matriz" className={enlaceClase}>
            Matriz
          </NavLink>
        </nav>

        <div className="border-t border-white/10 p-3">
          <NavLink
            to="/login"
            className="flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-medium text-azul-tenue transition-colors hover:bg-navy-sidebar hover:text-white"
          >
            <LogOut size={13} />
            Cerrar sesión
          </NavLink>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="h-11 shrink-0 border-b border-gray-200 bg-white" />

        <main className="flex-1 overflow-auto bg-fondo-pagina p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
