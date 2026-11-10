import type { Metadata } from "next";
import { Archive, ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta } from "@/components/ui";
import { cuentaPorId } from "@/db/cuentas";
import { aspectoParaElegir, destinoAlEliminarCuenta } from "@/lib/cuentas";
import { formatearCentavos } from "@/lib/dinero";
import { BotonEliminarCuenta } from "../botones-cuenta";
import { FormularioCuenta } from "../formulario-cuenta";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Editar cuenta" };
export const dynamic = "force-dynamic";

/** Editar cuenta (spec 013, criterios 4 a 9): el formulario y, debajo, eliminar o archivar si está en 0. */
export default async function EditarCuenta({ params }: PageProps<"/cuentas/[id]">) {
  await exigirSesion();
  const { id } = await params;
  const cuenta = await cuentaPorId(Number(id));
  if (!cuenta) notFound();

  const destino = destinoAlEliminarCuenta(cuenta);
  const archivar = destino === "archivar";
  const saldo =
    cuenta.moneda === "USD"
      ? formatearCentavos(cuenta.saldoCentavos)
      : `${formatearCentavos(cuenta.saldoCentavos, cuenta.moneda)} (${formatearCentavos(cuenta.saldoUsdCentavos)})`;

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex items-center gap-2 px-1 lg:col-span-12 lg:px-0">
        <Link
          href="/cuentas"
          aria-label="Volver a cuentas"
          className="tarjeta grid size-9 place-items-center rounded-full text-texto-2 hover:text-texto"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Editar cuenta</h1>
      </header>

      <FormularioCuenta
        id={cuenta.id}
        inicial={{ nombre: cuenta.nombre, moneda: cuenta.moneda, tipo: cuenta.tipo, ...aspectoParaElegir(cuenta) }}
        monedaFija={cuenta.usos > 0}
      />

      {cuenta.activa ? (
        <Tarjeta className="lg:col-span-7">
          {/* Antes de confirmar se dice si se borrará, se archivará o por qué no se puede. Sin JavaScript, con <details>. */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold text-negativo">
              {archivar ? <Archive size={16} aria-hidden /> : <Trash2 size={16} aria-hidden />}
              {archivar ? "Archivar cuenta" : "Eliminar cuenta"}
            </summary>
            <div className="mt-3 flex flex-col gap-3 border-t border-tarjeta-borde pt-3">
              <p className="text-[13px] text-texto-2">
                {destino === "con-saldo"
                  ? `Tiene ${saldo}. Para quitarla, primero pasa ese dinero a otra cuenta con Transferir y deja el saldo en 0.`
                  : archivar
                    ? "Está en 0 pero tiene historial: se archivará, no se borra. Deja de verse en Cuentas y al registrar, y sus movimientos la conservan; puedes restaurarla."
                    : "Está en 0 y no tiene movimientos: se borrará del todo."}
              </p>
              {destino === "con-saldo" ? null : <BotonEliminarCuenta id={cuenta.id} archivar={archivar} />}
            </div>
          </details>
        </Tarjeta>
      ) : null}
    </main>
  );
}
