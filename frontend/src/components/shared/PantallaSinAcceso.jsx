/**
 * Pantalla completa para una sesión válida que no puede usar ningún módulo.
 *
 * TARJETA: [E-01/HU-01] FE - Pantalla para rol sin módulos habilitados (gestor)
 *
 * `RutaProtegida` la muestra EN LUGAR de todo el layout: no se monta el
 * menú ni ninguna pantalla, así que tampoco se dispara ninguna petición.
 * Lo único que la persona puede hacer es cerrar sesión.
 *
 * Genérica a propósito (`titulo`/`descripcion`): la pantalla de "cuenta sin
 * rol" del CA05 (PR #203) puede reutilizarla cambiando solo el mensaje,
 * como pide la tarjeta.
 *
 * Es solo UI: el backend responde 403 a esos roles en todas las rutas (D37).
 */
import { useAutenticacion } from "../../auth/ProveedorAutenticacion.jsx";
import Boton from "./Boton.jsx";
import Card from "./Card.jsx";
import EncabezadoPantalla from "./EncabezadoPantalla.jsx";

export default function PantallaSinAcceso({ titulo, descripcion }) {
  const { cerrarSesion } = useAutenticacion();

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <Card as="section" role="alert" className="w-full max-w-lg">
        <EncabezadoPantalla titulo={titulo} descripcion={descripcion} />
        <Boton variante="secundario" onClick={cerrarSesion}>
          Cerrar sesión
        </Boton>
      </Card>
    </div>
  );
}
