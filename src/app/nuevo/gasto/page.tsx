import type { Metadata } from "next";
import Link from "next/link";
import { Pildora } from "@/components/ui";
import { categoriasDeGastoPorUso, cuentaPorDefectoParaGasto, saldosPorCuenta, sobresParaGasto } from "@/db/consultas";
import { hoyEnCaracas } from "@/lib/fechas";
import { FormularioGasto } from "./formulario-gasto";

export const metadata: Metadata = { title: "Nuevo gasto" };
export const dynamic = "force-dynamic";

const formas = ["dolares", "vendiendo", "saldo"] as const;

/** Captura rápida de gasto (spec 001). `?forma=` y `?cuenta=` vienen de "Registrar otro" sin JavaScript. */
export default async function NuevoGasto({ searchParams }: PageProps<"/nuevo/gasto">) {
  const parametros = await searchParams;
  const [categorias, sobres, cuentas, cuentaPorDefecto] = await Promise.all([
    categoriasDeGastoPorUso(),
    sobresParaGasto(),
    saldosPorCuenta(),
    cuentaPorDefectoParaGasto(),
  ]);

  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const forma = formas.find((f) => f === parametros.forma) ?? "dolares";
  const pedida = enDolares.find((c) => String(c.id) === parametros.cuenta);
  const cuentaId = String(pedida?.id ?? cuentaPorDefecto ?? enDolares[0]?.id ?? "");

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-3 px-1 lg:col-span-12 lg:px-0">
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Nuevo gasto</h1>
        <nav aria-label="Tipo de movimiento" className="tarjeta flex w-fit items-center gap-1 rounded-full p-1">
          <span aria-current="page">
            <Pildora tono="palida">Gasto</Pildora>
          </span>
          <Link
            href="/nuevo?tipo=ingreso"
            className="rounded-full px-2.5 py-1 text-[12px] font-bold text-texto-2 hover:text-texto"
          >
            Ingreso
          </Link>
          <Link
            href="/nuevo?tipo=mover"
            className="rounded-full px-2.5 py-1 text-[12px] font-bold text-texto-2 hover:text-texto"
          >
            Mover
          </Link>
        </nav>
      </header>

      <FormularioGasto
        categorias={categorias.map(({ id, nombre }) => ({ id, nombre }))}
        sobres={sobres.map(({ id, nombre, tipo, saldoCentavos, topeCentavos }) => ({
          id,
          nombre,
          tipo,
          saldoCentavos,
          topeCentavos,
        }))}
        cuentas={cuentas.map(({ id, nombre, moneda, esPropia, saldoCentavos }) => ({
          id,
          nombre,
          moneda,
          esPropia,
          saldoCentavos,
        }))}
        hoy={hoyEnCaracas(new Date())}
        inicial={{ forma, cuentaId }}
      />
    </main>
  );
}
