import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { esVuelta } from "@/lib/borrador-captura";
import { colorPorDefecto, iconoPorDefecto } from "@/lib/categorias";
import { FormularioCategoria } from "../formulario-categoria";

export const metadata: Metadata = { title: "Nueva categoría" };

/**
 * Crear categoría (spec 001, criterio 18). `?tipo=` la abre en gasto o ingreso; `?volver=/nuevo/gasto…`
 * viene de la píldora "Nueva" de la captura, con lo escrito, y vuelve allí con la categoría elegida (25).
 */
export default async function NuevaCategoria({ searchParams }: PageProps<"/categorias/nueva">) {
  const parametros = await searchParams;
  const tipo = parametros.tipo === "ingreso" ? "ingreso" : "gasto";
  const volver =
    typeof parametros.volver === "string" && esVuelta(parametros.volver, ["/nuevo/gasto"])
      ? parametros.volver
      : undefined;

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex items-center gap-2 px-1 lg:col-span-12 lg:px-0">
        <Link
          href={volver ?? `/categorias?tipo=${tipo}`}
          aria-label="Volver"
          className="tarjeta grid size-9 place-items-center rounded-full text-texto-2 hover:text-texto"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Nueva categoría</h1>
      </header>
      <FormularioCategoria
        inicial={{ nombre: "", tipo, icono: iconoPorDefecto, color: colorPorDefecto }}
        volver={volver}
      />
    </main>
  );
}
