import type { Metadata } from "next";
import { Cifra, EncabezadoTarjeta, Pildora, Tarjeta, TituloPagina } from "@/components/ui";
import { saldosPorSobre } from "@/db/consultas";
import { deudasConPendiente, sobreDeudas } from "@/db/deudas";
import { cuotaDelMes } from "@/db/reparto";
import { sobresParaApartar } from "@/lib/apartado";
import { pendientePorSentido } from "@/lib/deudas";
import { formatearCifra } from "@/lib/dinero";
import { hoyEnCaracas, mesDe, nombreMes } from "@/lib/fechas";
import { FormularioApartar } from "./formulario-apartar";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Apartar para deudas" };
export const dynamic = "force-dynamic";

/**
 * Apartar lo que ya se tiene (spec 005, criterio 13): arriba lo que tiene Deudas, lo que se debe y la cuota del mes;
 * debajo, de qué sobre y cuánto. Nunca desde Deudas ni desde Inversión; "Por asignar" sí, y viene elegido si tiene.
 */
export default async function Apartar() {
  await exigirSesion();
  const [deudas, sobres, cuota, lista] = await Promise.all([
    sobreDeudas(),
    saldosPorSobre(),
    cuotaDelMes(),
    deudasConPendiente(),
  ]);
  const { deboCentavos } = pendientePorSentido(lista);
  const origenes = sobresParaApartar(sobres).filter((s) => s.id !== deudas?.id);
  const inicial = origenes.find((s) => s.tipo === "por_asignar") ?? origenes[0];
  const mes = nombreMes(mesDe(hoyEnCaracas(new Date())).mes).toLowerCase();

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Apartar para deudas" />
      <section className="hero rounded-tarjeta p-5 lg:col-span-6 lg:col-start-4 lg:p-6">
        <p className="text-[13px] font-semibold text-white/75">Apartado en Deudas</p>
        <div className="mt-2">
          <Cifra centavos={deudas?.saldoCentavos ?? 0} tamano="hero" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pildora tono="hero">Debo {formatearCifra(deboCentavos)}</Pildora>
          <Pildora tono="hero">
            Cuota de {mes} {formatearCifra(cuota?.cuotaCentavos ?? 0)}
          </Pildora>
        </div>
      </section>

      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <EncabezadoTarjeta titulo="Apartar para deudas" />
        {!deudas?.activo ? (
          <p className="text-[13px] text-negativo">No hay un sobre Deudas activo: no se puede apartar.</p>
        ) : origenes.length === 0 ? (
          <p className="text-[13px] text-texto-3">Ningún sobre tiene saldo para apartar.</p>
        ) : (
          <FormularioApartar
            inicial={{ idCaptura: crypto.randomUUID(), sobreOrigenId: String(inicial?.id ?? ""), monto: "" }}
            origenes={origenes.map(({ id, nombre, saldoCentavos }) => ({ id, nombre, saldoCentavos }))}
          />
        )}
      </Tarjeta>
    </main>
  );
}
