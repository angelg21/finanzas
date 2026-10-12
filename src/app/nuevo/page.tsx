import type { Metadata } from "next";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Tarjeta, TituloPagina } from "@/components/ui";

export const metadata: Metadata = { title: "Registrar" };

const opciones = [
  { tipo: "gasto", texto: "Gasto", detalle: "Lo más frecuente. En dólares o en bolívares.", Icono: ArrowUpRight },
  { tipo: "ingreso", texto: "Ingreso", detalle: "Cae en Por asignar y propone el reparto.", Icono: ArrowDownLeft },
  { tipo: "mover", texto: "Mover", detalle: "Entre cuentas o entre sobres.", Icono: ArrowLeftRight },
] as const;

export default async function Nuevo({ searchParams }: PageProps<"/nuevo">) {
  const { tipo } = await searchParams;
  const elegido = typeof tipo === "string" ? tipo : null;

  return (
    <main className="flex flex-col gap-4 lg:gap-5">
      <TituloPagina titulo="Registrar" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-5">
        {opciones.map(({ tipo: t, texto, detalle, Icono }) => {
          const activa = elegido === t;
          return (
            <Link
              key={t}
              href={t === "gasto" ? "/nuevo/gasto" : `/nuevo?tipo=${t}`}
              aria-current={activa ? "true" : undefined}
              className={`palida flex items-center gap-4 rounded-palida p-4 lg:flex-col lg:items-start lg:gap-5 lg:p-5 ${
                activa ? "ring-2 ring-white" : ""
              }`}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-pildora-navy text-white">
                <Icono size={22} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] font-bold text-palida-texto">{texto}</span>
                <span className="block text-[12px] text-palida-texto-2">{detalle}</span>
              </span>
            </Link>
          );
        })}
      </div>
      <Tarjeta>
        <p className="text-[13px] text-texto-2">
          Gasto ya tiene su pantalla de captura rápida. Ingreso y Mover llegan en las siguientes features.
        </p>
      </Tarjeta>
    </main>
  );
}
