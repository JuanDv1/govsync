/**
 * Plan de Acción de consulta pública, sin credenciales.
 *
 * TARJETA: [E-01/HU-01] FE - Acceso como visitante sin credenciales
 * DECISIONES DEL PO (2026-11-16): ruta `/publico/plan-accion` FUERA de
 * `RutaProtegida` (ver App.jsx), sin menú de módulos y con la opción "Iniciar
 * sesión"; reutiliza la pantalla del Plan de Acción en modo público
 * (`PlanAccion publico`), no una copia.
 *
 * Este archivo solo pone el marco (encabezado de marca y enlace a `/login`).
 * No lee la sesión: la pantalla es la misma con o sin ella, y los datos se
 * piden sin `Authorization` (api/cliente.js, `planAccionPublicoActual`). El
 * visitante con cuenta sigue usando `/plan-accion`, con login.
 */
import Boton from "../components/shared/Boton.jsx";
import PlanAccion from "./PlanAccion.jsx";

export default function PlanAccionPublico() {
  return (
    <div className="min-h-screen bg-fondo-pagina">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <div className="text-xl font-bold tracking-[0.12em] text-navy">
              GOV<span className="text-azul-accion">SYNC</span>
            </div>
            <p className="text-ayuda text-gray-600">
              Consulta pública · Alcaldía Municipal de Santa Rosa, Cauca
            </p>
          </div>
          <Boton variante="secundario" to="/login">
            Iniciar sesión
          </Boton>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <PlanAccion publico />
      </main>
    </div>
  );
}
