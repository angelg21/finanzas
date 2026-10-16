import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Repeat } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconoSobre } from "@/components/icono-sobre";
import { tituloDeDeuda } from "@/components/movimiento";
import {
  Avatar,
  Cifra,
  Dato,
  EncabezadoTarjeta,
  FilaLista,
  Pildora,
  Progreso,
  Tarjeta,
  TarjetaPalida,
  iniciales,
} from "@/components/ui";
import { movimientosDeSobre, partidasDeSobre, reglaDeSobre, sobrePorId, type MovimientoReciente } from "@/db/consultas";
import { deudasConPendiente } from "@/db/deudas";
import type { Sobre } from "@/db/schema";
import { aporteMensualCentavos, totalAnualCentavos } from "@/lib/fondos";
import { formatearCentavos } from "@/lib/dinero";
import { pendientePorSentido } from "@/lib/deudas";
import { cambioEnSobre } from "@/lib/saldos";
import { nivelParaIcono } from "@/lib/sobres";
import { BotonEliminarPartida, FormularioAporte, FormularioPartida, nombresMes } from "./formularios";
import { exigirSesion } from "@/app/sesion";

export const dynamic = "force-dynamic";

const nombreTipo: Record<Sobre["tipo"], string> = {
  por_asignar: "Por asignar",
  gastos: "Gastos del mes",
  familia: "Apoyo familiar",
  emergencia: "Fondo de emergencia",
  meta: "Meta",
  inversion: "Inversión",
  fondo: "Fondo de reserva",
  deudas: "Para pagar deudas",
};

export async function generateMetadata({ params }: PageProps<"/sobres/[id]">): Promise<Metadata> {
  await exigirSesion();
  const { id } = await params;
  const sobre = await sobrePorId(Number(id));
  return { title: sobre ? sobre.nombre : "Sobre" };
}

function fechaCorta(iso: string) {
  return iso.split("-").reverse().join("-");
}

const etiquetaTipo: Record<MovimientoReciente["tipo"], string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  transferencia: "Transferencia",
  reasignacion: "Reasignación",
  pago_deuda: "Pago de deuda",
  prestamo: "Préstamo",
  cobro_prestamo: "Cobro de préstamo",
};

export default async function DetalleSobre({ params }: PageProps<"/sobres/[id]">) {
  await exigirSesion();
  const { id } = await params;
  const sobreId = Number(id);
  if (!Number.isInteger(sobreId)) notFound();
  const sobre = await sobrePorId(sobreId);
  if (!sobre) notFound();

  const [partidas, regla, movimientos, debidoCentavos] = await Promise.all([
    partidasDeSobre(sobreId),
    reglaDeSobre(sobreId),
    movimientosDeSobre(sobreId, 30),
    // Deudas se mide contra lo que se debe, como en /sobres. Con datos rotos, sin medida (guardian-datos, T6).
    sobre.tipo === "deudas"
      ? deudasConPendiente().then(
          (deudas) => pendientePorSentido(deudas).deboCentavos,
          () => null,
        )
      : null,
  ]);

  const esFondo = sobre.tipo === "fondo";
  const totalAnual = totalAnualCentavos(partidas);
  const aporteCalculado = partidas.length > 0 ? aporteMensualCentavos(totalAnual) : null;
  const aporteManual = regla?.tipo === "fijo" ? regla.valor : null;
  const aporte = aporteCalculado ?? aporteManual ?? 0;
  const avance = sobre.topeCentavos ? sobre.saldoCentavos / sobre.topeCentavos : null;
  const nivel = nivelParaIcono({
    saldoCentavos: sobre.saldoCentavos,
    topeCentavos: sobre.topeCentavos,
    anualCentavos: partidas.length > 0 ? totalAnual : null,
    fijoMensualCentavos: regla?.activa && regla.tipo === "fijo" ? regla.valor : null,
    debidoCentavos,
  });

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <div className="flex items-center justify-between lg:col-span-12">
        <Link href="/sobres" className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto">
          <ArrowLeft size={16} aria-hidden />
          Sobres
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-7 lg:gap-5">
        <section className="hero rounded-tarjeta p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <IconoSobre clave={sobre.id} tipo={sobre.tipo} nivel={nivel} tamano="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-bold">{sobre.nombre}</h1>
              <p className="text-[13px] text-white/75">{nombreTipo[sobre.tipo] ?? sobre.tipo}</p>
            </div>
          </div>
          <div className="mt-4">
            <Cifra centavos={sobre.saldoCentavos} tamano="hero" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {esFondo ? (
              <Pildora tono="hero">
                <Repeat size={13} aria-hidden />
                {formatearCentavos(aporte)} al mes
              </Pildora>
            ) : null}
            {regla && !esFondo ? (
              <Pildora tono="hero">
                <Repeat size={13} aria-hidden />
                {regla.tipo === "fijo"
                  ? `${formatearCentavos(regla.valor)} al mes`
                  : `${regla.valor / 100} % de lo que queda`}
              </Pildora>
            ) : null}
            {sobre.topeCentavos ? <Pildora tono="hero">Tope {formatearCentavos(sobre.topeCentavos)}</Pildora> : null}
          </div>
          {avance !== null ? (
            <div className="mt-4">
              <Progreso valor={avance} />
              <p className="mt-2 text-[12px] text-white/75">{Math.round(avance * 100)} % del tope</p>
            </div>
          ) : null}
        </section>

        <Tarjeta>
          <EncabezadoTarjeta titulo="Movimientos de este sobre" />
          {movimientos.length === 0 ? (
            <p className="text-[13px] text-texto-3">Todavía no hay movimientos en este sobre.</p>
          ) : (
            <div className="flex flex-col">
              {movimientos.map((m) => {
                const efecto = cambioEnSobre(m, sobre.id);
                const deDeuda = tituloDeDeuda(m.tipo, m.persona);
                return (
                  <FilaLista
                    key={m.id}
                    avatar={<Avatar texto={iniciales(m.persona ?? m.categoria ?? etiquetaTipo[m.tipo])} />}
                    titulo={deDeuda ?? m.nota ?? m.categoria ?? etiquetaTipo[m.tipo]}
                    subtitulo={`${fechaCorta(m.fecha)} · ${m.tipo === "reasignacion" ? `${m.sobreOrigen} → ${m.sobreDestino}` : (m.categoria ?? etiquetaTipo[m.tipo])}`}
                    derecha={<Cifra centavos={efecto} tono={efecto > 0 ? "positivo" : "texto"} signo />}
                  />
                );
              })}
            </div>
          )}
        </Tarjeta>
      </div>

      {esFondo ? (
        <div className="flex flex-col gap-4 lg:col-span-5 lg:gap-5">
          <TarjetaPalida>
            <EncabezadoTarjeta
              titulo="Desglose del año"
              palida
              derecha={<Pildora tono="navy">{formatearCentavos(aporte)} / mes</Pildora>}
            />
            <p className="text-[13px] text-palida-texto-2">
              Lo que esperas gastar en el año en estas ocasiones. El aporte mensual es el total entre doce, redondeado
              al dólar.
            </p>

            {partidas.length === 0 ? (
              <div className="mt-4 rounded-[16px] bg-pildora-blanca p-4">
                <p className="text-[13px] text-palida-texto-2">
                  Todavía no hay ocasiones. Mientras tanto vale el aporte fijo de abajo.
                </p>
                <div className="mt-3">
                  <FormularioAporte sobreId={sobreId} actualCentavos={aporte} />
                </div>
              </div>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-palida-pista">
                {partidas.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-palida-texto">{p.nombre}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-palida-texto-2">
                        {p.mes ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays size={12} aria-hidden />
                            {nombresMes[p.mes - 1]}
                          </span>
                        ) : null}
                        <span>
                          {formatearCentavos(p.montoCentavos)}
                          {p.vecesPorAnio > 1 ? ` × ${p.vecesPorAnio}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="tabular text-[14px] font-bold text-palida-texto">
                      {formatearCentavos(p.montoCentavos * p.vecesPorAnio)}
                    </span>
                    <BotonEliminarPartida id={p.id} sobreId={sobreId} nombre={p.nombre} />
                  </li>
                ))}
              </ul>
            )}

            {partidas.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-palida-pista pt-3">
                <Dato etiqueta="Total anual">{formatearCentavos(totalAnual)}</Dato>
                <Dato etiqueta="Entre doce">{formatearCentavos(aporte)}</Dato>
              </div>
            ) : null}
          </TarjetaPalida>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Agregar ocasión" />
            <FormularioPartida sobreId={sobreId} />
          </Tarjeta>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:col-span-5 lg:gap-5">
          <TarjetaPalida>
            <EncabezadoTarjeta titulo="Cómo funciona" palida />
            <p className="text-[13px] text-palida-texto-2">{sobre.nota ?? "Sobre del presupuesto."}</p>
            {sobre.fechaObjetivo ? (
              <p className="mt-2 text-[13px] text-palida-texto-2">Fecha objetivo: {fechaCorta(sobre.fechaObjetivo)}.</p>
            ) : null}
          </TarjetaPalida>
        </div>
      )}
    </main>
  );
}
