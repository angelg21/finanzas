import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Boton } from "@/components/formulario";
import { Tarjeta, TituloPagina } from "@/components/ui";
import { saldosPorCuenta } from "@/db/consultas";
import { deudaPorId } from "@/db/deudas";
import { centavosATexto } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import { borrarDeudaAccion } from "../../acciones";
import { FormularioDeuda } from "../../formulario-deuda";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Editar deuda" };
export const dynamic = "force-dynamic";

/**
 * Corregir una deuda (spec 005, criterio 16): persona, fecha, cuenta prevista, nota y monto inicial, sin cambiar el
 * sentido. Sin movimientos se puede borrar; con ellos no se ofrece.
 */
export default async function EditarDeuda({ params }: PageProps<"/deudas/[id]/editar">) {
  await exigirSesion();
  const { id } = await params;
  const deudaId = Number(id);
  if (!Number.isSafeInteger(deudaId) || deudaId <= 0) notFound();
  const [deuda, todas] = await Promise.all([deudaPorId(deudaId), saldosPorCuenta()]);
  if (!deuda) notFound();
  const cuentas = todas.filter((c) => c.moneda !== "VES");
  const hoy = hoyEnCaracas(new Date());

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Editar deuda" />
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <FormularioDeuda
          inicial={{
            id: String(deuda.id),
            idCaptura: crypto.randomUUID(),
            sentido: deuda.sentido,
            persona: deuda.persona,
            monto: centavosATexto(deuda.montoInicialCentavos),
            fechaPrevista: deuda.fechaPrevista ?? "",
            cuentaPrevistaId: deuda.cuentaPrevistaId === null ? "" : String(deuda.cuentaPrevistaId),
            nota: deuda.nota ?? "",
          }}
          cuentas={cuentas.map(({ id: cuentaId, nombre, moneda }) => ({ id: cuentaId, nombre, moneda }))}
          hoy={hoy}
          editando
        />
        {deuda.movimientos === 0 ? (
          <form action={borrarDeudaAccion} className="mt-4 flex justify-center border-t border-tarjeta-borde pt-3">
            <input type="hidden" name="id" value={deuda.id} />
            <Boton type="submit" variante="peligro">
              Borrar
            </Boton>
          </form>
        ) : null}
      </Tarjeta>
    </main>
  );
}
