import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { FormularioCuenta } from "../formulario-cuenta";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Nueva cuenta" };

/** Crear cuenta (spec 013, criterios 1 y 2): empieza en 0; el dinero llega con Transferir o un ingreso. */
export default async function NuevaCuenta() {
  await exigirSesion();
  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex items-center gap-2 px-1 lg:col-span-12 lg:px-0">
        <Link
          href="/cuentas"
          aria-label="Volver a cuentas"
          className="tarjeta grid size-9 place-items-center rounded-full text-texto-2 hover:text-texto"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Nueva cuenta</h1>
      </header>
      <FormularioCuenta
        inicial={{ nombre: "", moneda: "USD", tipo: "billetera", icono: "billetera", color: "turquesa" }}
      />
    </main>
  );
}
