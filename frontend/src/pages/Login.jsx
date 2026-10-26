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
import Boton from "../components/shared/Boton.jsx";
import EncabezadoPantalla from "../components/shared/EncabezadoPantalla.jsx";

export default function Login() {
  const { iniciarSesion, cargando } = useAutenticacion();

  return (
    <div className="flex min-h-screen">
      {/* Relleno de 32 px y de 48 px desde `xl`: con zoom o en pantallas de
          1024 px el panel azul es angosto y 48 px le dejaban poco texto. */}
      <aside className="flex w-[42%] shrink-0 flex-col justify-between bg-navy p-8 xl:p-12">
        <div>
          <div className="text-2xl font-bold tracking-[0.12em] text-white">
            GOV<span className="text-azul-claro">SYNC</span>
          </div>
          <p className="mt-1 text-minimo font-medium uppercase tracking-wide text-azul-tenue">
            Sistema de Gestión · Plan de Desarrollo
          </p>
        </div>

        <div className="border-l-2 border-azul pl-4">
          <p className="text-campo leading-relaxed text-blue-100">
            <span className="font-medium text-white">
              Plan de Desarrollo Municipal 2024–2027
            </span>{" "}
            — consolidación y cruce de la información de planeación, ejecución
            presupuestal y proyectos de inversión.
          </p>
          <p className="mt-2 text-campo text-azul-claro">
            Alcaldía Municipal de Santa Rosa, Cauca
          </p>
        </div>

        <div className="flex justify-between text-ayuda text-azul-apagado">
          <span>v2.0.0</span>
          <span className="font-mono">Vigencia 2026</span>
        </div>
      </aside>

      {/* `w-full max-w-sm` (384 px) en vez de un ancho fijo en línea: el
          formulario se encoge con el panel y nunca lo desborda. */}
      <div className="flex min-w-0 flex-1 items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm">
          <EncabezadoPantalla
            titulo="Iniciar sesión"
            descripcion="Acceso restringido a funcionarios autorizados de la Alcaldía."
          />

          {/* Mientras verifica la sesión el botón queda inactivo y su propio
              texto ("Verificando sesión…") es el motivo visible. */}
          <Boton
            onClick={iniciarSesion}
            deshabilitado={cargando}
            className="w-full"
          >
            {cargando ? "Verificando sesión…" : "Ingresar"}
          </Boton>
        </div>
      </div>
    </div>
  );
}
