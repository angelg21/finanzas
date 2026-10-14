import type { Metadata } from "next";
import { Boton } from "@/components/formulario";

export const metadata: Metadata = { title: "Sin conexión" };
export const dynamic = "force-static";

/**
 * /sin-conexion (spec 002, criterio 20): el mismo marco que /entrar, con el emblema en el lado de la marca. El
 * service worker la guarda al instalarse y la muestra en cualquier navegación sin red. Es estática: no consulta la
 * base ni la sesión, y nunca muestra saldos. "Reintentar" vuelve a pedir la dirección en la que se está con un
 * formulario GET, sin JavaScript: el de la página no queda guardado.
 */
export default function SinConexion() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold tracking-tight">Sin conexión</h1>
        <p className="text-texto-2">Sin red no se puede registrar ni consultar. Tus datos siguen a salvo.</p>
      </div>
      <form method="get">
        <Boton type="submit" variante="secundario" className="h-[52px] w-full">
          Reintentar
        </Boton>
      </form>
    </div>
  );
}
