import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta } from "@/components/ui";
import { categoriaDelMovimiento } from "@/db/categorias";
import { categoriasDeGastoPorUso } from "@/db/consultas";
import { porCompletarPorId } from "@/db/por-completar";
import { centavosATexto } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import { FormularioEditarPorCompletar } from "./formulario-editar";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Editar por completar" };
export const dynamic = "force-dynamic";

/**
 * Corregir un gasto por completar (spec 010): categoría, descripción, fecha y monto, con el formulario de anotar. Uno
 * que ya no existe responde 404 (criterio 2); si su categoría se archivó, sale igual entre las opciones (criterio 3).
 */
export default async function EditarPorCompletar({ params }: PageProps<"/por-completar/[id]">) {
  await exigirSesion();
  const { id } = await params;
  const [pendiente, activas] = await Promise.all([porCompletarPorId(Number(id)), categoriasDeGastoPorUso()]);
  if (!pendiente) notFound();
  const archivada = activas.some((c) => c.id === pendiente.categoriaId)
    ? null
    : await categoriaDelMovimiento(pendiente.categoriaId, "gasto");
  const categorias = [...activas, ...(archivada ? [archivada] : [])];

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-2 px-1 lg:col-span-12 lg:px-0">
        <Link
          href="/por-completar"
          className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto"
        >
          <ArrowLeft size={16} aria-hidden />
          Por completar
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight">Editar por completar</h1>
        <p className="text-[13px] text-texto-2">No mueve dinero: solo corrige lo anotado.</p>
      </header>
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <FormularioEditarPorCompletar
          id={pendiente.id}
          categorias={categorias.map(({ id: c, nombre, icono, color }) => ({ id: c, nombre, icono, color }))}
          hoy={hoyEnCaracas(new Date())}
          inicial={{
            idCaptura: "",
            categoriaId: String(pendiente.categoriaId),
            nota: pendiente.nota ?? "",
            fecha: pendiente.fecha,
            monto: pendiente.montoCentavos === null ? "" : centavosATexto(pendiente.montoCentavos),
            moneda: pendiente.moneda ?? "VES",
          }}
        />
      </Tarjeta>
    </main>
  );
}
