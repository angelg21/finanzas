import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, HandHelping, PiggyBank, Plus } from "lucide-react";
import { Cifra, EncabezadoTarjeta, Mosaico, Pildora, Tarjeta, TarjetaPalida, TituloPagina } from "@/components/ui";
import { AvisoPasajero } from "@/components/aviso-pasajero";
import { saldosPorCuenta } from "@/db/consultas";
import { deudasConPendiente, sobreDeudas } from "@/db/deudas";
import { cuotaDelMes } from "@/db/reparto";
import { pendientePorSentido } from "@/lib/deudas";
import { formatearCifra } from "@/lib/dinero";
import { hoyEnCaracas, mesDe, nombreMes } from "@/lib/fechas";
import { avisosDeLiquidez } from "@/lib/liquidez";
import { FilaDeuda } from "./fila-deuda";
import { NadaPorAqui } from "./nada-por-aqui";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Deudas" };
export const dynamic = "force-dynamic";

/** La regla de uso del plan (sección 6), escrita donde se decide (criterio 17). */
const reglaDeUso =
  "Una deuda corta con un amigo se paga antes de repartir el siguiente ingreso. Presta solo lo que podrías regalar sin resentimiento.";

/**
 * Lo que debo y lo que me deben (spec 005): el total que debo, lo apartado en Deudas y la cuota del mes, la regla de
 * uso y cada deuda abierta con su aviso de liquidez. Sin sobre Deudas activo lo dice y no ofrece apartar (criterio 10).
 */
export default async function Deudas({ searchParams }: PageProps<"/deudas">) {
  await exigirSesion();
  const { guardado } = await searchParams;
  const [deudas, sobre, cuota, cuentas] = await Promise.all([
    deudasConPendiente(),
    sobreDeudas(),
    cuotaDelMes(),
    saldosPorCuenta(),
  ]);
  const hoy = hoyEnCaracas(new Date());
  const { deboCentavos, meDebenCentavos } = pendientePorSentido(deudas);
  const avisos = avisosDeLiquidez({ deudas, cuentas });
  const debo = deudas.filter((d) => d.sentido === "debo");
  const abiertas = debo.filter((d) => d.estado === "abierta");
  const pagadas = debo.filter((d) => d.estado === "pagada");
  const meDeben = deudas.filter((d) => d.sentido === "me_deben");
  const porCobrar = meDeben.filter((d) => d.estado === "abierta");
  const cobradas = meDeben.filter((d) => d.estado === "pagada");
  const deudasActivo = sobre?.activo === true;
  const mes = nombreMes(mesDe(hoy).mes).toLowerCase();

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Deudas" />

      <section className="hero rounded-tarjeta p-5 lg:col-span-7 lg:p-6">
        <p className="text-[13px] font-semibold text-white/75">Debo</p>
        <div className="mt-2">
          <Cifra centavos={deboCentavos} tamano="hero" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {guardado === "apartado" ? (
            <AvisoPasajero parametros={["guardado"]}>
              <Pildora tono="positiva">
                <CheckCircle2 size={13} aria-hidden />
                Apartado guardado
              </Pildora>
            </AvisoPasajero>
          ) : null}
          {deudasActivo ? (
            <>
              <Pildora tono="hero">Apartado {formatearCifra(sobre.saldoCentavos)}</Pildora>
              <Pildora tono="hero">
                Cuota de {mes} {formatearCifra(cuota?.cuotaCentavos ?? 0)}
              </Pildora>
            </>
          ) : (
            <Pildora tono="negativa">
              <CircleAlert size={13} aria-hidden />
              Sin sobre Deudas activo: no se puede pagar ni apartar
            </Pildora>
          )}
          <Pildora tono="hero">Me deben {formatearCifra(meDebenCentavos)}</Pildora>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Mosaico href="/deudas/nueva" icono={<Plus size={18} aria-hidden />} texto="Nueva deuda" />
          <Mosaico href="/deudas/prestar" icono={<HandHelping size={18} aria-hidden />} texto="Prestar" />
          {deudasActivo ? (
            <Mosaico href="/deudas/apartar" icono={<PiggyBank size={18} aria-hidden />} texto="Apartar" />
          ) : null}
        </div>
      </section>

      <TarjetaPalida className="lg:col-span-5">
        <EncabezadoTarjeta titulo="Regla de uso" palida />
        <p className="text-[14px] font-semibold leading-snug text-palida-texto">{reglaDeUso}</p>
      </TarjetaPalida>

      <Tarjeta className="lg:col-span-7">
        <EncabezadoTarjeta
          titulo="Debo"
          derecha={abiertas.length > 0 ? <Pildora>{abiertas.length} abiertas</Pildora> : undefined}
        />
        {abiertas.length === 0 ? (
          <NadaPorAqui href="/deudas/nueva" />
        ) : (
          <div className="flex flex-col">
            {abiertas.map((d) => {
              const aviso = avisos.get(d.id);
              return <FilaDeuda key={d.id} deuda={d} hoy={hoy} aviso={aviso?.texto} />;
            })}
          </div>
        )}
        {pagadas.length > 0 ? (
          <details className="mt-2 border-t border-tarjeta-borde pt-2">
            <summary className="cursor-pointer py-2 text-[13px] font-semibold text-enlace hover:text-texto">
              Pagadas ({pagadas.length})
            </summary>
            <div className="flex flex-col">
              {pagadas.map((d) => (
                <FilaDeuda key={d.id} deuda={d} hoy={hoy} />
              ))}
            </div>
          </details>
        ) : null}
      </Tarjeta>

      <Tarjeta className="lg:col-span-5">
        <EncabezadoTarjeta
          titulo="Me deben"
          derecha={porCobrar.length > 0 ? <Pildora>{porCobrar.length} abiertas</Pildora> : undefined}
        />
        {porCobrar.length === 0 ? (
          <NadaPorAqui href="/deudas/nueva?sentido=me_deben" />
        ) : (
          <div className="flex flex-col">
            {porCobrar.map((d) => (
              <FilaDeuda key={d.id} deuda={d} hoy={hoy} />
            ))}
          </div>
        )}
        {cobradas.length > 0 ? (
          <details className="mt-2 border-t border-tarjeta-borde pt-2">
            <summary className="cursor-pointer py-2 text-[13px] font-semibold text-enlace hover:text-texto">
              Cobradas ({cobradas.length})
            </summary>
            <div className="flex flex-col">
              {cobradas.map((d) => (
                <FilaDeuda key={d.id} deuda={d} hoy={hoy} />
              ))}
            </div>
          </details>
        ) : null}
      </Tarjeta>
    </main>
  );
}
