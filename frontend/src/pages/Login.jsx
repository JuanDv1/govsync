/**
 * Pantalla de inicio de sesión.
 *
 * Solo interfaz visual — la autenticación (épica E-01) está deliberadamente
 * fuera de alcance del sprint actual (docs/DECISIONES.md D2, [REF-05]). Este
 * componente no llama a ningún endpoint ni guarda sesión: el formulario y
 * los botones de acceso de prueba son estáticos, a la espera de que la
 * tarjeta de E-01 defina el flujo real.
 */
export default function Login() {
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
        <form
          onSubmit={(evento) => evento.preventDefault()}
          style={{ width: "22rem" }}
        >
          <h2 className="text-xl font-semibold text-navy">Iniciar sesión</h2>
          <p className="mb-7 text-xs text-gray-500">
            Acceso restringido a funcionarios autorizados de la Alcaldía.
          </p>

          <div className="mb-4">
            <label
              htmlFor="correo"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
            >
              Correo
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              autoComplete="username"
              className="w-full rounded-sm border border-gray-300 bg-fondo-input px-3 py-2.5 text-sm focus:border-azul focus:outline-none focus:ring-1 focus:ring-azul"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="contrasena"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
            >
              Contraseña
            </label>
            <input
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-sm border border-gray-300 bg-fondo-input px-3 py-2.5 text-sm focus:border-azul focus:outline-none focus:ring-1 focus:ring-azul"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-sm bg-navy py-2.5 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-navy-hover"
          >
            Ingresar
          </button>

          <div className="mt-7 border-t border-gray-100 pt-5">
            <p className="mb-3 text-center text-[10px] uppercase tracking-widest text-gray-400">
              Acceso de prueba
            </p>
            <div className="grid grid-cols-3 gap-2">
              {["Planeación", "Hacienda", "Control interno"].map((rol) => (
                <button
                  key={rol}
                  type="button"
                  className="rounded-sm border border-gray-200 px-2 py-2.5 text-center text-[11px] font-medium text-gray-600 transition-colors hover:border-azul hover:bg-blue-50/40 hover:text-navy"
                >
                  {rol}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[10px] leading-relaxed text-gray-300">
              Acceso de prueba deshabilitado — la autenticación aún no está
              implementada (docs/DECISIONES.md D2).
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
