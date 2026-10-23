import { CheckCircle2, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EnlaceBoton } from "@/components/formulario";
import { GraficaDona, type SegmentoDona } from "@/components/grafica-dona";
import { IconoSobre } from "@/components/icono-sobre";
import { Cifra, EncabezadoTarjeta, Pildora, Progreso, Tarjeta, TarjetaPalida, TituloPagina } from "@/components/ui";
import { AvisoPasajero } from "@/components/aviso-pasajero";
import type { Sobre } from "@/db/schema";
import { sobresConNivel } from "@/db/sobres";
import { formatearCentavos, formatearEnteros } from "@/lib/dinero";
import { pasoDeSobre } from "@/lib/sobres";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Sobres" };
export const dynamic = "force-dynamic";

const descripcion: Record<Sobre["tipo"], string> = {
  por_asignar: "Dinero que llegó y todavía no tiene trabajo.",
  gastos: "Todo el consumo del mes, ocio incluido.",
  familia: "Apoyo a la familia.",
  emergencia: "Seis meses de gastos. Solo para emergencias reales.",
  meta: "Ahorro con monto y fecha.",
  inversion: "Aportes al bróker. Nunca se retira.",
  fondo: "Gastos previsibles pero irregulares. Aporte fijo mensual; lo que sobra se acumula.",
  deudas: "Lo apartado para pagar lo que debes. Recibe su cuota en cada reparto.",
};

function fechaCorta(iso: string) {
  const [a, m] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-VE", { month: "short", year: "numeric" }).format(new Date(a, m - 1, 1));
}

export default async function Sobres({ searchParams }: PageProps<"/sobres">) {
  await exigirSesion();
  const sobres = await sobresConNivel();
  const total = sobres.reduce((acc, s) => acc + s.saldoCentavos, 0);
  const porAsignar = sobres.find((s) => s.tipo === "por_asignar");
  const resto = sobres.filter((s) => s.tipo !== "por_asignar");

  const segmentos: SegmentoDona[] = resto.map((s) => ({
    clave: String(s.id),
    nombre: s.nombre,
    valorCentavos: Math.max(s.saldoCentavos, 0),
    paso: pasoDeSobre(s.tipo),
  }));

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Sobres" detalle={<Cifra centavos={total} tamano="sm" tono="texto-2" />} />
      <div className="-mt-2 flex items-center justify-end gap-4 px-1 lg:col-span-12 lg:mt-0 lg:px-0">
        {(await searchParams).movido === "1" ? (
          <AvisoPasajero parametros={["movido"]} className="mr-auto">
            <Pildora tono="positiva">
              <CheckCircle2 size={13} aria-hidden />
              Movido
            </Pildora>
          </AvisoPasajero>
        ) : null}
        <Link
          href="/nuevo/mover"
          className="flex items-center gap-0.5 text-[13px] font-semibold text-enlace hover:text-texto"
        >
          Mover entre sobres
          <ChevronRight size={16} aria-hidden />
        </Link>
        <Link
          href="/sobres/reglas"
          className="flex items-center gap-0.5 text-[13px] font-semibold text-enlace hover:text-texto"
        >
          Reglas de reparto
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      {porAsignar && porAsignar.saldoCentavos !== 0 ? (
        <section className="hero rounded-tarjeta p-5 lg:col-span-12 lg:flex lg:items-center lg:justify-between lg:p-6">
          <div>
            <p className="text-[13px] font-semibold text-white/75">Por asignar</p>
            <div className="mt-2">
              <Cifra centavos={porAsignar.saldoCentavos} tamano="hero" />
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-3 lg:mt-0 lg:items-end">
            <p className="max-w-sm text-[13px] text-white/75 lg:text-right">
              Este dinero todavía no tiene un sobre. Repártelo según tus reglas.
            </p>
            {porAsignar.saldoCentavos > 0 ? (
              <EnlaceBoton href="/sobres/repartir" variante="secundario" className="w-full lg:w-auto">
                Repartir
              </EnlaceBoton>
            ) : null}
          </div>
        </section>
      ) : null}

      <TarjetaPalida className="lg:sticky lg:top-24 lg:col-span-5">
        <EncabezadoTarjeta
          titulo="Distribución"
          palida
          derecha={<Pildora tono="navy">{formatearEnteros(total)} USD</Pildora>}
        />
        <GraficaDona segmentos={segmentos} titulo="Distribución de sobres" />
      </TarjetaPalida>

      <div className="flex flex-col gap-4 lg:col-span-7 lg:gap-5">
        {resto.map((s) => {
          const avance = s.topeCentavos ? s.saldoCentavos / s.topeCentavos : null;
          const lleno = avance !== null && avance >= 1;
          return (
            <Link
              key={s.id}
              href={`/sobres/${s.id}`}
              className="block rounded-tarjeta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palido"
            >
              <Tarjeta className="hover:bg-tarjeta-hover">
                <div className="flex items-center gap-3">
                  <IconoSobre clave={s.id} tipo={s.tipo} nivel={s.nivel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[13px] font-extrabold uppercase tracking-wide">{s.nombre}</h2>
                      {s.tipo === "inversion" ? <Pildora tono="oscura">Intocable</Pildora> : null}
                      {lleno ? <Pildora tono="positiva">Lleno</Pildora> : null}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-texto-3">{descripcion[s.tipo] ?? s.tipo}</p>
                  </div>
                  <Cifra centavos={s.saldoCentavos} tamano="lg" />
                </div>
                {avance !== null ? (
                  <div className="mt-4">
                    <Progreso valor={avance} />
                    <div className="mt-2 flex items-center justify-between text-[12px] text-texto-3">
                      <span className={`font-bold ${lleno ? "text-positivo" : "text-enlace"}`}>
                        {Math.round(avance * 100)} % del tope
                      </span>
                      <span>
                        {s.fechaObjetivo ? `para ${fechaCorta(s.fechaObjetivo)} · ` : ""}
                        de {formatearCentavos(s.topeCentavos ?? 0)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </Tarjeta>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
