import type { Metadata } from "next";
import Link from "next/link";
import {
  categoriasDeGastoPorUso,
  cuentaPorDefectoParaGasto,
  cuentaPorDefectoParaVenta,
  saldosPorCuenta,
  sobresParaGasto,
} from "@/db/consultas";
import { todasLasEtiquetas } from "@/db/etiquetas";
import { porCompletarPorId } from "@/db/por-completar";
import { centavosATexto } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import { SelectorTipo } from "../selector-tipo";
import { FormularioGasto } from "./formulario-gasto";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Nuevo gasto" };
export const dynamic = "force-dynamic";

const formas = ["dolares", "vendiendo", "saldo"] as const;

/** Captura rápida de gasto (spec 001). `?forma=`, `?cuenta=` y `?venta=` vienen de "Registrar otro" sin JavaScript. */
export default async function NuevoGasto({ searchParams }: PageProps<"/nuevo/gasto">) {
  await exigirSesion();
  const parametros = await searchParams;
  const [categorias, sobres, cuentas, cuentaPorDefecto, cuentaVentaPorDefecto, etiquetas] = await Promise.all([
    categoriasDeGastoPorUso(),
    sobresParaGasto(),
    saldosPorCuenta(),
    cuentaPorDefectoParaGasto(),
    cuentaPorDefectoParaVenta(),
    todasLasEtiquetas(),
  ]);

  // Spec 009: al completar un gasto anotado, viene con lo que ya se sabía. Sin ?pendiente=, ninguna consulta más.
  const pendiente =
    typeof parametros.pendiente === "string" ? await porCompletarPorId(Number(parametros.pendiente)) : null;

  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const formaPorMoneda = pendiente?.moneda === "VES" ? "vendiendo" : pendiente?.moneda === "USD" ? "dolares" : null;
  const forma = formaPorMoneda ?? formas.find((f) => f === parametros.forma) ?? "dolares";
  const pedida = (id: unknown) => enDolares.find((c) => String(c.id) === id)?.id;
  // Sin cuenta propia en dólares activa no se marca ninguna: la de la prima nunca se preselecciona (ADR 0006).
  const cuentaId = String(pedida(parametros.cuenta) ?? cuentaPorDefecto ?? "");
  // La venta tiene su propio valor por defecto: Binance, aunque el último gasto fuera desde otra cuenta.
  const cuentaVentaId = String(pedida(parametros.venta) ?? cuentaVentaPorDefecto ?? "");
  // Al volver de crear una categoría con "Nueva", llega ya elegida (criterio 25).
  const categoriaId = categorias
    .find((c) => String(c.id) === (pendiente ? String(pendiente.categoriaId) : parametros.categoria))
    ?.id.toString();

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-3 px-1 lg:col-span-12 lg:px-0">
        <h1 className={`text-[24px] font-extrabold tracking-tight ${pendiente ? "" : "lg:hidden"}`}>
          {pendiente ? "Completar gasto" : "Nuevo gasto"}
        </h1>
        <SelectorTipo actual="gasto" />
        {/* Spec 009: si todavía no se sabe el monto en dólares, la cuenta o el sobre. */}
        <Link href="/nuevo/por-completar" className="self-start text-[13px] font-semibold text-enlace hover:text-texto">
          Anotar sin monto
        </Link>
      </header>

      <FormularioGasto
        categorias={categorias.map(({ id, nombre, icono, color }) => ({ id, nombre, icono, color }))}
        etiquetas={etiquetas}
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
        inicial={{
          forma,
          cuentaId,
          cuentaVentaId,
          categoriaId,
          idCaptura: crypto.randomUUID(),
          ...(pendiente
            ? {
                pendienteId: pendiente.id,
                monto: pendiente.montoCentavos === null ? "" : centavosATexto(pendiente.montoCentavos),
                nota: pendiente.nota ?? "",
                fecha: pendiente.fecha,
              }
            : {}),
        }}
      />
    </main>
  );
}
