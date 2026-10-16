import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, TrendingDown } from "lucide-react";
import Link from "next/link";
import { CirculoCuenta } from "@/components/circulo-cuenta";
import { GraficaDona, type SegmentoDona } from "@/components/grafica-dona";
import { GraficaMensual } from "@/components/grafica-mensual";
import { IconoSobre } from "@/components/icono-sobre";
import { FilaMovimiento } from "@/components/movimiento";
import { Cifra, EncabezadoTarjeta, FilaLista, Mosaico, Pildora, Tarjeta, TarjetaPalida } from "@/components/ui";
import { gastadoEsteMes, movimientosRecientes, resumenMensual, saldosPorCuenta } from "@/db/consultas";
import type { Sobre } from "@/db/schema";
import { sobresConNivel } from "@/db/sobres";
import { formatearCentavos, formatearEnteros } from "@/lib/dinero";
import { diasQueQuedanDelMes, hoyEnCaracas } from "@/lib/fechas";
import { etiquetaDia } from "@/lib/periodos";
import { pasoDeSobre } from "@/lib/sobres";
import { exigirSesion } from "@/app/sesion";

export const dynamic = "force-dynamic";

const nombreTipoSobre: Record<Sobre["tipo"], string> = {
  por_asignar: "Por asignar",
  gastos: "Gastos del mes",
  familia: "Apoyo familiar",
  emergencia: "Fondo de emergencia",
  meta: "Meta",
  inversion: "Inversión",
  fondo: "Fondo de reserva",
  deudas: "Para pagar deudas",
};

const nombreTipoCuenta: Record<string, string> = {
  exchange: "Exchange",
  billetera: "Billetera",
  efectivo: "Efectivo",
  banco: "Banco",
  transito: "USD en EE. UU.",
};

/** En hora de Caracas: el servidor (Vercel) corre en UTC. */
function diasRestantesDelMes() {
  return diasQueQuedanDelMes(hoyEnCaracas(new Date()));
}

export default async function Inicio() {
  await exigirSesion();
  const [sobres, cuentas, gastado, resumen, recientes] = await Promise.all([
    sobresConNivel(),
    saldosPorCuenta(),
    gastadoEsteMes(),
    resumenMensual(6),
    movimientosRecientes(5),
  ]);

  const gastosDelMes = sobres.find((s) => s.tipo === "gastos");
  const porAsignar = sobres.find((s) => s.tipo === "por_asignar");
  const sobresReales = sobres.filter((s) => s.tipo !== "por_asignar");
  const totalSobres = sobres.reduce((acc, s) => acc + s.saldoCentavos, 0);
  const dias = diasRestantesDelMes();
  const hoy = hoyEnCaracas(new Date());
  const recientesPorDia = new Map<string, typeof recientes>();
  for (const m of recientes) recientesPorDia.set(m.fecha, [...(recientesPorDia.get(m.fecha) ?? []), m]);

  const segmentos: SegmentoDona[] = sobresReales.map((s) => ({
    clave: String(s.id),
    nombre: s.nombre,
    valorCentavos: Math.max(s.saldoCentavos, 0),
    paso: pasoDeSobre(s.tipo),
  }));

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      {/* Tarjeta principal: lo único que se puede gastar es el sobre de gastos del mes. */}
      <section className="hero rounded-tarjeta p-5 lg:col-span-7 lg:p-6">
        <p className="text-[13px] font-semibold text-white/75">Disponible para gastar</p>
        <div className="mt-2">
          <Cifra centavos={gastosDelMes?.saldoCentavos ?? 0} tamano="hero" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pildora tono="hero">
            <TrendingDown size={13} aria-hidden />
            {formatearCentavos(-gastado)} este mes
          </Pildora>
          <Pildora tono="hero">
            <CalendarDays size={13} aria-hidden />
            {dias === 0 ? "Último día del mes" : `${dias} ${dias === 1 ? "día" : "días"} restantes`}
          </Pildora>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Mosaico href="/nuevo/gasto" icono={<ArrowUpRight size={18} aria-hidden />} texto="Gasto" />
          <Mosaico href="/nuevo/ingreso" icono={<ArrowDownLeft size={18} aria-hidden />} texto="Ingreso" />
          <Mosaico href="/nuevo?tipo=mover" icono={<ArrowLeftRight size={18} aria-hidden />} texto="Mover" />
        </div>
        {porAsignar && porAsignar.saldoCentavos !== 0 ? (
          <p className="mt-4 text-[13px] text-white/75">
            Tienes <span className="font-bold text-white">{formatearCentavos(porAsignar.saldoCentavos)}</span> sin
            asignar a ningún sobre.{" "}
            {porAsignar.saldoCentavos > 0 ? (
              <Link href="/sobres/repartir" className="font-bold text-white underline underline-offset-2">
                Repartir
              </Link>
            ) : null}
          </p>
        ) : null}
      </section>

      {/* Anillo de distribución: solo en escritorio en el inicio; en móvil vive en Sobres. */}
      <TarjetaPalida className="hidden lg:col-span-5 lg:block">
        <EncabezadoTarjeta
          titulo="Distribución de sobres"
          palida
          derecha={<Pildora tono="navy">{formatearEnteros(totalSobres)} USD</Pildora>}
        />
        <GraficaDona segmentos={segmentos} titulo="Distribución de sobres" />
      </TarjetaPalida>

      <Tarjeta className="lg:col-span-5">
        <EncabezadoTarjeta titulo="Sobres" enlace={{ href: "/sobres", texto: "Ver todos" }} />
        <div className="flex flex-col">
          {sobresReales.slice(0, 4).map((s) => {
            const avance = s.topeCentavos ? s.saldoCentavos / s.topeCentavos : null;
            return (
              <FilaLista
                key={s.id}
                href={`/sobres/${s.id}`}
                avatar={<IconoSobre clave={s.id} tipo={s.tipo} nivel={s.nivel} />}
                titulo={s.nombre}
                subtitulo={nombreTipoSobre[s.tipo] ?? s.tipo}
                derecha={
                  <>
                    <Cifra centavos={s.saldoCentavos} />
                    {avance !== null ? (
                      <span className={`text-[12px] font-bold ${avance >= 1 ? "text-positivo" : "text-enlace"}`}>
                        {Math.round(avance * 100)} % del tope
                      </span>
                    ) : s.tipo === "inversion" ? (
                      <span className="text-[12px] font-bold text-enlace">Intocable</span>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </div>
      </Tarjeta>

      <Tarjeta className="lg:col-span-7">
        <EncabezadoTarjeta titulo="Ingresos y gastos" derecha={<Pildora tono="oscura">6 meses</Pildora>} />
        <GraficaMensual datos={resumen} />
      </Tarjeta>

      <Tarjeta className="lg:col-span-5">
        <EncabezadoTarjeta titulo="Cuentas" enlace={{ href: "/cuentas", texto: "Ver todas" }} />
        <div className="flex flex-col">
          {cuentas.map((c) => (
            <FilaLista
              key={c.id}
              href="/cuentas"
              avatar={<CirculoCuenta tipo={c.tipo} moneda={c.moneda} />}
              titulo={c.nombre}
              subtitulo={`${nombreTipoCuenta[c.tipo] ?? c.tipo} · ${c.moneda}`}
              derecha={
                <>
                  <Cifra centavos={c.saldoCentavos} moneda={c.moneda} />
                  {!c.esPropia ? (
                    <span className="text-[12px] text-texto-3">A nombre de mi prima</span>
                  ) : c.moneda !== "USD" ? (
                    <Cifra centavos={c.saldoUsdCentavos} tamano="sm" tono="texto-3" />
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      </Tarjeta>

      {/* Últimos movimientos como en /movimientos, agrupados por día: solo en escritorio, junto a Cuentas. */}
      <Tarjeta className="hidden lg:col-span-7 lg:block">
        <EncabezadoTarjeta titulo="Últimos movimientos" enlace={{ href: "/movimientos", texto: "Ver todos" }} />
        {recientes.length === 0 ? (
          <p className="text-[13px] text-texto-2">Todavía no hay movimientos.</p>
        ) : (
          [...recientesPorDia.entries()].map(([fecha, movimientos]) => (
            <section key={fecha} aria-label={etiquetaDia(fecha, hoy)} className="pt-2 first-of-type:pt-0">
              <h3 className="text-[12px] font-bold text-texto-3">{etiquetaDia(fecha, hoy)}</h3>
              <ul className="divide-y divide-tarjeta-borde">
                {movimientos.map((m) => (
                  <li key={m.id}>
                    <FilaMovimiento m={m} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Tarjeta>
    </main>
  );
}
