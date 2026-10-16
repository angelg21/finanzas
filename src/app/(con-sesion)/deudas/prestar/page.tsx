import type { Metadata } from "next";
import { Tarjeta, TituloPagina } from "@/components/ui";
import { saldosPorCuenta, saldosPorSobre } from "@/db/consultas";
import { hoyEnCaracas } from "@/lib/fechas";
import { puedePrestarDesde } from "@/lib/prestamos";
import { FormularioPrestar } from "./formulario-prestar";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Prestar" };
export const dynamic = "force-dynamic";

/**
 * Prestar dinero a otro (spec 005, criterio 4): sale de una cuenta en dólares y de un sobre, nunca de Deudas ni de
 * Inversión; "Por asignar" sí, y viene elegido si tiene. No es un gasto: queda como algo que me deben.
 */
export default async function Prestar() {
  await exigirSesion();
  const [cuentas, sobres] = await Promise.all([saldosPorCuenta(), saldosPorSobre()]);
  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const origenes = sobres.filter((s) => puedePrestarDesde(s.tipo));
  const porAsignar = origenes.find((s) => s.tipo === "por_asignar" && s.saldoCentavos > 0);
  const hoy = hoyEnCaracas(new Date());

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Prestar" />
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        {enDolares.length === 0 ? (
          <p className="text-[13px] text-negativo">No hay ninguna cuenta en dólares activa.</p>
        ) : (
          <FormularioPrestar
            inicial={{
              idCaptura: crypto.randomUUID(),
              persona: "",
              monto: "",
              cuentaId: String(enDolares[0].id),
              sobreOrigenId: porAsignar ? String(porAsignar.id) : "",
              fecha: "hoy",
              fechaPrevista: "",
              nota: "",
            }}
            cuentas={enDolares.map(({ id, nombre, moneda }) => ({ id, nombre, moneda }))}
            sobres={origenes.map(({ id, nombre, saldoCentavos }) => ({ id, nombre, saldoCentavos }))}
            hoy={hoy}
          />
        )}
      </Tarjeta>
    </main>
  );
}
