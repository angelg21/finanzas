import type { Metadata } from "next";
import { FormularioEntrar } from "./formulario-entrar";

export const metadata: Metadata = { title: "Entrar" };

/**
 * /entrar (spec 002, "Pantallas"): el lado del formulario; la marca la pone el layout. Con sesión, el proxy la manda
 * a /. `siguiente` viaja en el formulario y la acción lo pasa por destinoSeguro antes de redirigir.
 */
export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { siguiente } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold tracking-tight">Entrar</h1>
        <p className="text-texto-2">Con tu correo y tu contraseña.</p>
      </div>
      <FormularioEntrar siguiente={typeof siguiente === "string" ? siguiente : ""} />
    </div>
  );
}
