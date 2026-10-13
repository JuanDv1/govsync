/**
 * Pantalla de inicio de sesión.
 *
 * [HU-E01-01] (docs/DECISIONES.md D23/D24): se mantiene como superficie
 * visual de entrada, pero ya no es un formulario — el botón "Ingresar"
 * redirige a Keycloak (Authorization Code + PKCE, vía
 * `useAutenticacion().iniciarSesion()`), que es quien de verdad pide
 * correo/contraseña, con el theme de la marca GovSync
 * (`keycloak/themes/govsync/`). Por eso ya no hay campos de correo/
 * contraseña ni el bloque de "acceso de prueba": ambos asumían que la
 * autenticación no existía todavía (D2/[REF-05]), y ya no es el caso.
 */
import { useAutenticacion } from "../auth/ProveedorAutenticacion.jsx";

export default function Login() {
  const { iniciarSesion, cargando } = useAutenticacion();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[42%] shrink-0 flex-col justify-between bg-navy p-12">
        <div>
          <div className="text-2xl font-bold tracking-[0.12em] text-white">
            GOV<span className="text-azul-claro">SYNC</span>
          </div>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-azul-tenue">
            Sistema de Gestión · Plan de Desarrollo
          </p>
        </div>

        <div className="border-l-2 border-azul pl-4">
          <p className="text-sm leading-relaxed text-blue-100">
            <span className="font-medium text-white">
              Plan de Desarrollo Municipal 2024–2027
            </span>{" "}
            — consolidación y cruce de la información de planeación, ejecución
            presupuestal y proyectos de inversión.
          </p>
          <p className="mt-2 text-xs text-azul-claro">
            Alcaldía Municipal de Santa Rosa, Cauca
          </p>
        </div>

        <div className="flex justify-between text-[11px] text-azul-apagado">
          <span>v2.0.0</span>
          <span className="font-mono">Vigencia 2026</span>
        </div>
      </aside>

      <div className="flex flex-1 items-center justify-center bg-white">
        <div style={{ width: "22rem" }}>
          <h2 className="text-xl font-semibold text-navy">Iniciar sesión</h2>
          <p className="mb-7 text-xs text-gray-500">
            Acceso restringido a funcionarios autorizados de la Alcaldía.
          </p>

          <button
            type="button"
            onClick={iniciarSesion}
            disabled={cargando}
            className="w-full rounded-sm bg-navy py-2.5 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? "Verificando sesión…" : "Ingresar"}
          </button>
        </div>
      </div>
    </div>
  );
}
