import type { Metadata } from "next";
import { Emblema } from "@/components/emblema";
import { Boton } from "@/components/formulario";

export const metadata: Metadata = { title: "Sin conexión" };
export const dynamic = "force-static";

/**
 * /sin-conexion (spec 002, criterio 20). El service worker la guarda al instalarse y la muestra en cualquier
 * navegación sin red. Es estática: no consulta la base ni la sesión, y nunca muestra saldos. "Reintentar" vuelve a
 * pedir la dirección en la que se está con un formulario GET, sin JavaScript: el de la página no queda guardado.
 */
export default function SinConexion() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <Emblema tamano={72} />
      <div className="flex flex-col gap-2">
        <h1 className="text-[24px] font-extrabold tracking-tight">Sin conexión</h1>
        <p className="text-texto-2">Sin red no se puede registrar ni consultar. Tus datos siguen a salvo.</p>
      </div>
      <form method="get" className="w-full">
        <Boton type="submit" variante="secundario" className="h-[52px] w-full">
          Reintentar
        </Boton>
      </form>
    </div>
  );
}
