import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Tarjeta } from "@/components/ui";
import { categoriasDeGastoPorUso } from "@/db/consultas";
import { hoyEnCaracas } from "@/lib/fechas";
import { FormularioPorCompletar } from "./formulario-por-completar";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Anotar por completar" };
export const dynamic = "force-dynamic";

/**
 * Anotar un gasto por completar (spec 009): lo que se sabe ahora, sin monto en dólares, cuenta ni sobre. No mueve
 * dinero; se completa después desde /por-completar.
 */
export default async function AnotarPorCompletar() {
  await exigirSesion();
  const categorias = await categoriasDeGastoPorUso();
  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-2 px-1 lg:col-span-12 lg:px-0">
        <Link href="/nuevo" className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto">
          <ArrowLeft size={16} aria-hidden />
          Registrar
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight">Anotar por completar</h1>
        <p className="text-[13px] text-texto-2">Anota ahora; el monto en dólares, la cuenta y el sobre, después.</p>
      </header>
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <FormularioPorCompletar
          idCaptura={crypto.randomUUID()}
          categorias={categorias.map(({ id, nombre, icono, color }) => ({ id, nombre, icono, color }))}
          hoy={hoyEnCaracas(new Date())}
        />
      </Tarjeta>
    </main>
  );
}
