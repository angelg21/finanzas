import type { Metadata } from "next";
import Link from "next/link";
import { GraficaDona, type SegmentoDona } from "@/components/grafica-dona";
import {
  Avatar,
  Cifra,
  EncabezadoTarjeta,
  Pildora,
  Progreso,
  Tarjeta,
  TarjetaPalida,
  TituloPagina,
  iniciales,
} from "@/components/ui";
import { saldosPorSobre } from "@/db/consultas";
import { formatearCentavos, formatearEnteros } from "@/lib/dinero";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Sobres" };
export const dynamic = "force-dynamic";

const descripcion: Record<string, string> = {
  por_asignar: "Dinero que llegó y todavía no tiene trabajo.",
  gastos: "Todo el consumo del mes, ocio incluido.",
  familia: "Apoyo a la familia.",
  emergencia: "Seis meses de gastos. Solo para emergencias reales.",
  meta: "Ahorro con monto y fecha.",
  inversion: "Aportes al bróker. Nunca se retira.",
  fondo: "Gastos previsibles pero irregulares. Aporte fijo mensual; lo que sobra se acumula.",
};

const pasoPorTipo: Record<string, SegmentoDona["paso"]> = {
  emergencia: 1,
  inversion: 2,
  meta: 3,
  gastos: 4,
  familia: 5,
  fondo: 6,
};

function fechaCorta(iso: string) {
  const [a, m] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-VE", { month: "short", year: "numeric" }).format(new Date(a, m - 1, 1));
}

export default async function Sobres() {
  await exigirSesion();
  const sobres = await saldosPorSobre();
  const total = sobres.reduce((acc, s) => acc + s.saldoCentavos, 0);
  const porAsignar = sobres.find((s) => s.tipo === "por_asignar");
  const resto = sobres.filter((s) => s.tipo !== "por_asignar");

  const segmentos: SegmentoDona[] = resto.map((s) => ({
    clave: String(s.id),
    nombre: s.nombre,
    valorCentavos: Math.max(s.saldoCentavos, 0),
    paso: pasoPorTipo[s.tipo] ?? 3,
  }));

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <TituloPagina titulo="Sobres" detalle={<Cifra centavos={total} tamano="sm" tono="texto-2" />} />

      {porAsignar && porAsignar.saldoCentavos !== 0 ? (
        <section className="hero rounded-tarjeta p-5 lg:col-span-12 lg:flex lg:items-center lg:justify-between lg:p-6">
          <div>
            <p className="text-[13px] font-semibold text-white/75">Por asignar</p>
            <div className="mt-2">
              <Cifra centavos={porAsignar.saldoCentavos} tamano="hero" />
            </div>
          </div>
          <p className="mt-3 max-w-sm text-[13px] text-white/75 lg:mt-0 lg:text-right">
            Este dinero todavía no tiene un sobre. Repártelo según tus reglas.
          </p>
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
                  <Avatar texto={iniciales(s.nombre)} />
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
