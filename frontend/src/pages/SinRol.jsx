/**
 * Pantalla para una cuenta con sesión válida pero sin rol de GovSync
 * ([E-01/HU-01] CA05).
 *
 * `RutaProtegida` la muestra en lugar de todo el layout, así que la cuenta
 * no ve el menú ni monta ninguna pantalla (ni dispara peticiones). Lo único
 * que puede hacer es cerrar sesión. Es solo UI: el backend rechaza igual a
 * una cuenta sin rol (tarjeta BE de CA05).
 */
import { useAutenticacion } from "../auth/ProveedorAutenticacion.jsx";
import Boton from "../components/shared/Boton.jsx";
import Card from "../components/shared/Card.jsx";
import EncabezadoPantalla from "../components/shared/EncabezadoPantalla.jsx";

export default function SinRol() {
  const { cerrarSesion } = useAutenticacion();

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <Card as="section" role="alert" className="w-full max-w-lg">
        <EncabezadoPantalla
          titulo="Su cuenta no tiene un rol asignado"
          descripcion="Contacte a la administradora para que le asigne un rol y pueda usar GovSync."
        />
        <Boton variante="secundario" onClick={cerrarSesion}>
          Cerrar sesión
        </Boton>
      </Card>
    </div>
  );
}
