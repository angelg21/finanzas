import type { Metadata } from "next";
import Link from "next/link";
import { Pildora } from "@/components/ui";
import {
  categoriasDeGastoPorUso,
  cuentaPorDefectoParaGasto,
  cuentaPorDefectoParaVenta,
  saldosPorCuenta,
  sobresParaGasto,
} from "@/db/consultas";
import { hoyEnCaracas } from "@/lib/fechas";
import { FormularioGasto } from "./formulario-gasto";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Nuevo gasto" };
export const dynamic = "force-dynamic";

const formas = ["dolares", "vendiendo", "saldo"] as const;

/** Captura rápida de gasto (spec 001). `?forma=`, `?cuenta=` y `?venta=` vienen de "Registrar otro" sin JavaScript. */
export default async function NuevoGasto({ searchParams }: PageProps<"/nuevo/gasto">) {
  await exigirSesion();
  const parametros = await searchParams;
  const [categorias, sobres, cuentas, cuentaPorDefecto, cuentaVentaPorDefecto] = await Promise.all([
    categoriasDeGastoPorUso(),
    sobresParaGasto(),
    saldosPorCuenta(),
    cuentaPorDefectoParaGasto(),
    cuentaPorDefectoParaVenta(),
  ]);

  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const forma = formas.find((f) => f === parametros.forma) ?? "dolares";
  const pedida = (id: unknown) => enDolares.find((c) => String(c.id) === id)?.id;
  // Sin cuenta propia en dólares activa no se marca ninguna: la de la prima nunca se preselecciona (ADR 0006).
  const cuentaId = String(pedida(parametros.cuenta) ?? cuentaPorDefecto ?? "");
  // La venta tiene su propio valor por defecto: Binance, aunque el último gasto fuera desde otra cuenta.
  const cuentaVentaId = String(pedida(parametros.venta) ?? cuentaVentaPorDefecto ?? "");
  // Al volver de crear una categoría con "Nueva", llega ya elegida (criterio 25).
  const categoriaId = categorias.find((c) => String(c.id) === parametros.categoria)?.id.toString();

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-3 px-1 lg:col-span-12 lg:px-0">
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Nuevo gasto</h1>
        <nav aria-label="Tipo de movimiento" className="tarjeta flex w-fit items-center gap-1 rounded-full p-1">
          <span aria-current="page">
            <Pildora tono="palida">Gasto</Pildora>
          </span>
          <Link
            href="/nuevo/ingreso"
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
        categorias={categorias.map(({ id, nombre, icono, color }) => ({ id, nombre, icono, color }))}
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
        // Cada apertura es una captura nueva; el id viaja con lo tecleado y evita duplicar al reintentar.
        inicial={{ forma, cuentaId, cuentaVentaId, categoriaId, idCaptura: crypto.randomUUID() }}
      />
    </main>
  );
}
