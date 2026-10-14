import type { Metadata } from "next";
import { Emblema } from "@/components/emblema";
import { FormularioEntrar } from "./formulario-entrar";

export const metadata: Metadata = { title: "Entrar" };

/**
 * /entrar (spec 002, "Pantallas"). Con sesión, el proxy la manda a /. `siguiente` viaja en el formulario y la acción
 * lo pasa por destinoSeguro antes de redirigir.
 */
export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { siguiente } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <Emblema tamano={72} className="mx-auto" />
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-[24px] font-extrabold tracking-tight">Finanzas</h1>
        <p className="text-texto-2">Cada dólar tiene un trabajo.</p>
      </div>
      <FormularioEntrar siguiente={typeof siguiente === "string" ? siguiente : ""} />
    </div>
  );
}
