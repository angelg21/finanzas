import type { Metadata } from "next";
import { Plus, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { CirculoCategoria, EncabezadoTarjeta, Pildora, Tarjeta } from "@/components/ui";
import { type CategoriaConUso, categoriasConUso } from "@/db/categorias";
import { restaurarCategoriaAccion } from "./acciones";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Categorías" };
export const dynamic = "force-dynamic";

const pestanas = [
  { tipo: "gasto", texto: "Gastos" },
  { tipo: "ingreso", texto: "Ingresos" },
] as const;

/**
 * Categorías (spec 001, criterios 17 y 22): rejilla de círculos de color con su icono, como la referencia
 * docs/referencias/categorias-gestor-lista.jpg, ordenada por uso. `?tipo=` elige la pestaña y
 * `?archivadas=1` muestra las archivadas para restaurarlas.
 */
export default async function Categorias({ searchParams }: PageProps<"/categorias">) {
  await exigirSesion();
  const parametros = await searchParams;
  const tipo = parametros.tipo === "ingreso" ? "ingreso" : "gasto";
  const verArchivadas = parametros.archivadas === "1";
  const avisoNombre = parametros.aviso === "nombre";
  const delTipo = (await categoriasConUso()).filter((c) => c.tipo === tipo);
  const activas = delTipo.filter((c) => c.activa);
  const archivadas = delTipo.filter((c) => !c.activa);

  return (
    <main className="flex flex-col gap-4 lg:gap-5">
      <header className="flex flex-col gap-3 px-1 lg:px-0">
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Categorías</h1>
        <nav aria-label="Tipo de categoría" className="tarjeta flex w-fit items-center gap-1 rounded-full p-1">
          {pestanas.map((p) =>
            p.tipo === tipo ? (
              <span key={p.tipo} aria-current="page">
                <Pildora tono="palida">{p.texto}</Pildora>
              </span>
            ) : (
              <Link
                key={p.tipo}
                href={`/categorias?tipo=${p.tipo}`}
                className="rounded-full px-2.5 py-1 text-[12px] font-bold text-texto-2 hover:text-texto"
              >
                {p.texto}
              </Link>
            ),
          )}
        </nav>
      </header>

      <Tarjeta>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
          {activas.map((c) => (
            <li key={c.id}>
              <Celda href={`/categorias/${c.id}`} nombre={c.nombre} detalle={usoDe(c)}>
                <CirculoCategoria icono={c.icono} color={c.color} tamano="lg" />
              </Celda>
            </li>
          ))}
          <li>
            <Celda href={`/categorias/nueva?tipo=${tipo}`} nombre="Crear">
              <span className="grid size-14 place-items-center rounded-full border border-dashed border-tarjeta-borde bg-tarjeta-hover text-texto-2">
                <Plus size={24} strokeWidth={1.75} aria-hidden />
              </span>
            </Celda>
          </li>
        </ul>
      </Tarjeta>

      {archivadas.length > 0 ? (
        verArchivadas ? (
          <Tarjeta>
            <EncabezadoTarjeta
              titulo={`Archivadas (${archivadas.length})`}
              enlace={{ href: `/categorias?tipo=${tipo}`, texto: "Ocultar" }}
            />
            <p className="mb-4 text-[13px] text-texto-3">
              No se ofrecen al registrar, pero sus movimientos las conservan.
            </p>
            {avisoNombre ? (
              <p role="alert" className="mb-4 text-[13px] font-semibold text-negativo">
                No se puede restaurar: ya hay una activa con ese nombre. Cámbiale el nombre a una de las dos.
              </p>
            ) : null}
            <ul className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
              {archivadas.map((c) => (
                <li key={c.id} className="flex flex-col items-center gap-1.5 text-center">
                  <CirculoCategoria icono={c.icono} color={c.color} tamano="lg" className="opacity-45" />
                  <span className="w-full truncate text-[12px] font-semibold text-texto-3">{c.nombre}</span>
                  <form action={restaurarCategoriaAccion}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-enlace hover:bg-tarjeta-hover"
                    >
                      <RotateCcw size={12} aria-hidden />
                      Restaurar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : (
          <Link
            href={`/categorias?tipo=${tipo}&archivadas=1`}
            className="w-fit px-1 text-[13px] font-semibold text-enlace hover:text-texto"
          >
            Archivadas ({archivadas.length})
          </Link>
        )
      ) : null}
    </main>
  );
}

function usoDe(c: CategoriaConUso) {
  return c.movimientos === 1 ? "1 movimiento" : `${c.movimientos} movimientos`;
}

/** Una celda de la rejilla: el círculo y el nombre debajo, como en la referencia. */
function Celda({
  href,
  nombre,
  detalle,
  children,
}: {
  href: string;
  nombre: string;
  detalle?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      title={detalle ? `${nombre} · ${detalle}` : nombre}
      className="flex flex-col items-center gap-1.5 rounded-[14px] px-1 py-1.5 text-center hover:bg-tarjeta-hover"
    >
      {children}
      <span className="w-full truncate text-[12px] font-semibold text-texto">{nombre}</span>
    </Link>
  );
}
