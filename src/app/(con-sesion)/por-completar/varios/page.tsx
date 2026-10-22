import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Tarjeta } from "@/components/ui";
import {
  categoriasDeGastoPorUso,
  cuentaPorDefectoParaGasto,
  cuentaPorDefectoParaVenta,
  saldosPorCuenta,
  sobresParaGasto,
} from "@/db/consultas";
import { listarPorCompletar } from "@/db/por-completar";
import { centavosATexto } from "@/lib/dinero";
import { sobreSugerido } from "@/lib/gastos";
import { FormularioVarios } from "./formulario-varios";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Completar varios" };
export const dynamic = "force-dynamic";

/**
 * Completar varios gastos anotados a la vez (spec 009, criterios 8 a 10). Todos marcados al entrar, con el monto que
 * se anotó y el sobre que sugiere su categoría. Si todos los que tienen monto están en Bs, la forma de pago empieza en
 * "Bolívares vendiendo USDT".
 */
export default async function CompletarVarios() {
  await exigirSesion();
  const [pendientes, sobres, cuentas, categorias, cuentaPorDefecto, cuentaVentaPorDefecto] = await Promise.all([
    listarPorCompletar(),
    sobresParaGasto(),
    saldosPorCuenta(),
    categoriasDeGastoPorUso(),
    cuentaPorDefectoParaGasto(),
    cuentaPorDefectoParaVenta(),
  ]);
  // Inversión no se ofrece aquí: sacar de ella pide la confirmación de la captura.
  const aptos = sobres.filter((s) => s.tipo !== "inversion");
  const conMonto = pendientes.filter((p) => p.moneda !== null);
  const enBolivares = conMonto.length > 0 && conMonto.every((p) => p.moneda === "VES");

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
        <h1 className="text-[24px] font-extrabold tracking-tight">Completar varios</h1>
      </header>
      <Tarjeta className="lg:col-span-8 lg:col-start-3">
        {pendientes.length === 0 ? (
          <p className="text-texto-2">No hay gastos por completar.</p>
        ) : (
          <FormularioVarios
            pendientes={pendientes.map(({ id, fecha, nota, categoria, icono, color }) => ({
              id,
              fecha,
              nota,
              categoria,
              icono,
              color,
            }))}
            cuentas={cuentas
              .filter((c) => c.moneda !== "VES")
              .map(({ id, nombre, moneda }) => ({ id, nombre, moneda }))}
            sobres={aptos.map(({ id, nombre }) => ({ id, nombre }))}
            categorias={categorias.map(({ id, nombre }) => ({ id, nombre }))}
            inicial={{
              idCaptura: crypto.randomUUID(),
              forma: enBolivares ? "vendiendo" : "dolares",
              cuentaId: String(cuentaPorDefecto ?? ""),
              cuentaVentaId: String(cuentaVentaPorDefecto ?? ""),
              tasa: "",
              vendido: "",
              elegidos: pendientes.map((p) => String(p.id)),
              montos: Object.fromEntries(
                pendientes.map((p) => [String(p.id), p.montoCentavos === null ? "" : centavosATexto(p.montoCentavos)]),
              ),
              sobres: Object.fromEntries(
                pendientes.map((p) => [String(p.id), String(sobreSugerido(p.categoria, aptos) ?? "")]),
              ),
              resto: "",
              restoCategoriaId: "",
              restoSobreId: "",
            }}
          />
        )}
      </Tarjeta>
    </main>
  );
}
