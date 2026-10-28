import type { Metadata } from "next";
import { Tarjeta } from "@/components/ui";
import { saldosPorCuenta, sobresParaGasto } from "@/db/consultas";
import { hoyEnCaracas } from "@/lib/fechas";
import { SelectorTipo } from "../selector-tipo";
import { FormularioTransferir } from "./formulario-transferir";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Transferir entre cuentas" };
export const dynamic = "force-dynamic";

/**
 * Transferir entre cuentas (spec 011): de una cuenta en dólares a otra, con lo que salió y lo que llegó; la diferencia
 * es la comisión, un gasto del sobre que se elija (Gastos del mes por defecto). Ninguna cuenta viene elegida, como en
 * Mover: una por defecto movería dinero de una cuenta que no se eligió.
 */
export default async function Transferir() {
  await exigirSesion();
  const [cuentas, sobres] = await Promise.all([saldosPorCuenta(), sobresParaGasto()]);
  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const gastosDelMes = sobres.find((s) => s.tipo === "gastos");
  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-3 px-1 lg:col-span-12 lg:px-0">
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Transferir entre cuentas</h1>
        <SelectorTipo actual="transferir" />
      </header>
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <FormularioTransferir
          inicial={{
            idCaptura: crypto.randomUUID(),
            origenId: "",
            destinoId: "",
            salio: "",
            llego: "",
            sobreId: gastosDelMes ? String(gastosDelMes.id) : "",
            fecha: "hoy",
            nota: "",
          }}
          cuentas={enDolares.map(({ id, nombre, moneda, saldoCentavos }) => ({ id, nombre, moneda, saldoCentavos }))}
          sobres={sobres.map(({ id, nombre }) => ({ id, nombre }))}
          hoy={hoyEnCaracas(new Date())}
        />
      </Tarjeta>
    </main>
  );
}
