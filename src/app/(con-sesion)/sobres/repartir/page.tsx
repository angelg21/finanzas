import type { Metadata } from "next";
import { Cifra, Tarjeta, TituloPagina } from "@/components/ui";
import { datosDelReparto } from "@/db/reparto";
import { hoyEnCaracas } from "@/lib/fechas";
import { camposDePropuesta } from "@/lib/ingresos";
import { FormularioRepartir } from "./formulario-repartir";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Repartir" };
export const dynamic = "force-dynamic";

/**
 * Repartir lo que ya está en "Por asignar" (spec 004, criterio 10): un ingreso guardado con algo sin repartir, o lo que
 * traiga después el saldo inicial de una cuenta. Los campos llegan con la propuesta escrita, así que también sin
 * JavaScript el primer envío guarda.
 */
export default async function Repartir() {
  await exigirSesion();
  const { porAsignar, reglas, recibidoPorMes } = await datosDelReparto();
  const hoy = hoyEnCaracas(new Date());
  const saldo = porAsignar?.activo ? porAsignar.saldoCentavos : 0;

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Repartir" />
      <section className="hero rounded-tarjeta p-5 lg:col-span-6 lg:col-start-4 lg:p-6">
        <p className="text-[13px] font-semibold text-white/75">Por asignar</p>
        <div className="mt-2">
          <Cifra centavos={saldo} tamano="hero" />
        </div>
        <p className="mt-3 text-[13px] text-white/75">Repártelo según tus reglas; puedes cambiar cualquier monto.</p>
      </section>

      {porAsignar?.activo ? (
        // Siempre montado: sin JavaScript, el "Reparto guardado" vive en el estado de este formulario, y tras repartir
        // todo el saldo queda en 0.
        <FormularioRepartir
          saldoCentavos={saldo}
          reglas={reglas}
          recibidoPorMes={recibidoPorMes}
          hoy={hoy}
          inicial={{
            // Cada apertura es un reparto nuevo; el id evita repartir dos veces al reintentar.
            idCaptura: crypto.randomUUID(),
            asignaciones: saldo > 0 ? camposDePropuesta(saldo, hoy, reglas, recibidoPorMes) : {},
          }}
        />
      ) : (
        <Tarjeta className="lg:col-span-6 lg:col-start-4">
          <p className="text-[13px] text-texto-2">No hay un sobre &quot;Por asignar&quot; activo.</p>
        </Tarjeta>
      )}
    </main>
  );
}
