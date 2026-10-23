import type { Metadata } from "next";
import { Tarjeta } from "@/components/ui";
import { saldosPorSobre } from "@/db/consultas";
import { SelectorTipo } from "../selector-tipo";
import { FormularioMover } from "./formulario-mover";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Mover entre sobres" };
export const dynamic = "force-dynamic";

/**
 * Mover entre sobres (spec 007): de qué sobre, a qué sobre y cuánto, hasta lo que tiene el origen. Ni el origen ni el
 * destino vienen elegidos: un origen por defecto movía dinero de un sobre que no se eligió (revisión de la 007,
 * hallazgo 2). Mover entre cuentas llega con la feature de cuentas.
 */
export default async function Mover() {
  await exigirSesion();
  const sobres = await saldosPorSobre();
  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-3 px-1 lg:col-span-12 lg:px-0">
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Mover entre sobres</h1>
        <SelectorTipo actual="mover" />
      </header>
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <FormularioMover
          inicial={{
            idCaptura: crypto.randomUUID(),
            origenId: "",
            destinoId: "",
            monto: "",
            nota: "",
          }}
          sobres={sobres.map(({ id, nombre, tipo, saldoCentavos }) => ({ id, nombre, tipo, saldoCentavos }))}
        />
      </Tarjeta>
    </main>
  );
}
