import type { Metadata } from "next";
import { Archive, ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boton } from "@/components/formulario";
import { Tarjeta } from "@/components/ui";
import { categoriaPorId } from "@/db/categorias";
import { destinoAlEliminar } from "@/lib/categorias";
import { eliminarCategoriaAccion } from "../acciones";
import { FormularioCategoria } from "../formulario-categoria";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Editar categoría" };
export const dynamic = "force-dynamic";

/** Editar categoría (spec 001, criterios 20 y 21): el mismo formulario y, debajo, eliminar o archivar. */
export default async function EditarCategoria({ params }: PageProps<"/categorias/[id]">) {
  await exigirSesion();
  const { id } = await params;
  const categoria = await categoriaPorId(Number(id));
  if (!categoria) notFound();

  const archivar = destinoAlEliminar(categoria.movimientos) === "archivar";
  const cuantos = categoria.movimientos === 1 ? "1 movimiento" : `${categoria.movimientos} movimientos`;

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex items-center gap-2 px-1 lg:col-span-12 lg:px-0">
        <Link
          href={`/categorias?tipo=${categoria.tipo}`}
          aria-label="Volver a categorías"
          className="tarjeta grid size-9 place-items-center rounded-full text-texto-2 hover:text-texto"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Editar categoría</h1>
      </header>

      <FormularioCategoria
        id={categoria.id}
        inicial={{ nombre: categoria.nombre, tipo: categoria.tipo, icono: categoria.icono, color: categoria.color }}
        movimientos={categoria.movimientos}
      />

      {categoria.activa ? (
        <Tarjeta className="lg:col-span-7">
          {/* Criterio 21: antes de confirmar se dice si se borrará o se archivará. Sin JavaScript, con <details>. */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold text-negativo">
              {archivar ? <Archive size={16} aria-hidden /> : <Trash2 size={16} aria-hidden />}
              {archivar ? "Archivar categoría" : "Eliminar categoría"}
            </summary>
            <div className="mt-3 flex flex-col gap-3 border-t border-tarjeta-borde pt-3">
              <p className="text-[13px] text-texto-2">
                {archivar
                  ? `Tiene ${cuantos}: se archivará, no se borra. Deja de ofrecerse al registrar y sus movimientos la conservan; puedes restaurarla.`
                  : "No tiene movimientos: se borrará del todo."}
              </p>
              <form action={eliminarCategoriaAccion}>
                <input type="hidden" name="id" value={categoria.id} />
                <Boton type="submit" variante="peligro">
                  {archivar ? "Sí, archivar" : "Sí, eliminar"}
                </Boton>
              </form>
            </div>
          </details>
        </Tarjeta>
      ) : null}
    </main>
  );
}
