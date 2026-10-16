import type { Metadata } from "next";
import { Tarjeta, TituloPagina } from "@/components/ui";
import { saldosPorCuenta } from "@/db/consultas";
import { hoyEnCaracas } from "@/lib/fechas";
import { FormularioDeuda } from "../formulario-deuda";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Nueva deuda" };
export const dynamic = "force-dynamic";

/**
 * Registrar una deuda o un préstamo que ya existían (spec 005, criterio 1): se escribe lo que se debe hoy. No crea
 * movimientos ni cambia saldos. `?sentido=me_deben` llega con "Me deben" elegido.
 */
export default async function NuevaDeuda({ searchParams }: PageProps<"/deudas/nueva">) {
  await exigirSesion();
  const { sentido } = await searchParams;
  const cuentas = (await saldosPorCuenta()).filter((c) => c.moneda !== "VES");
  const hoy = hoyEnCaracas(new Date());

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Nueva deuda" />
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <FormularioDeuda
          inicial={{
            id: "",
            idCaptura: crypto.randomUUID(),
            sentido: sentido === "me_deben" ? "me_deben" : "debo",
            persona: "",
            monto: "",
            fechaPrevista: "",
            cuentaPrevistaId: "",
            nota: "",
          }}
          cuentas={cuentas.map(({ id, nombre, moneda }) => ({ id, nombre, moneda }))}
          hoy={hoy}
          editando={false}
        />
      </Tarjeta>
    </main>
  );
}
