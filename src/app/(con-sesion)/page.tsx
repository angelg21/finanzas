import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, ChevronRight, TrendingDown } from "lucide-react";
import Link from "next/link";
import { GraficaDona, type SegmentoDona } from "@/components/grafica-dona";
import { GraficaMensual } from "@/components/grafica-mensual";
import { TarjetaMovimiento } from "@/components/movimiento";
import {
  Avatar,
  Cifra,
  EncabezadoTarjeta,
  FilaLista,
  Mosaico,
  Pildora,
  Tarjeta,
  TarjetaPalida,
  iniciales,
} from "@/components/ui";
import { gastadoEsteMes, movimientosRecientes, resumenMensual, saldosPorCuenta, saldosPorSobre } from "@/db/consultas";
import { formatearCentavos, formatearEnteros } from "@/lib/dinero";
import { diasQueQuedanDelMes, hoyEnCaracas } from "@/lib/fechas";
import { exigirSesion } from "@/app/sesion";

export const dynamic = "force-dynamic";

const nombreTipoSobre: Record<string, string> = {
  por_asignar: "Por asignar",
  gastos: "Gastos del mes",
  familia: "Apoyo familiar",
  emergencia: "Fondo de emergencia",
  meta: "Meta",
  inversion: "Inversión",
  fondo: "Fondo de reserva",
};

const nombreTipoCuenta: Record<string, string> = {
  exchange: "Exchange",
  billetera: "Billetera",
  efectivo: "Efectivo",
  banco: "Banco",
  transito: "USD en EE. UU.",
};

/** El color del anillo sigue al tipo de sobre, no a su tamaño. */
const pasoPorTipo: Record<string, SegmentoDona["paso"]> = {
  emergencia: 1,
  inversion: 2,
  meta: 3,
  gastos: 4,
  familia: 5,
  fondo: 6,
};

/** En hora de Caracas: el servidor (Vercel) corre en UTC. */
function diasRestantesDelMes() {
  return diasQueQuedanDelMes(hoyEnCaracas(new Date()));
}

export default async function Inicio() {
  await exigirSesion();
  const [sobres, cuentas, gastado, resumen, recientes] = await Promise.all([
    saldosPorSobre(),
    saldosPorCuenta(),
    gastadoEsteMes(),
    resumenMensual(6),
    movimientosRecientes(2),
  ]);

  const gastosDelMes = sobres.find((s) => s.tipo === "gastos");
  const porAsignar = sobres.find((s) => s.tipo === "por_asignar");
  const sobresReales = sobres.filter((s) => s.tipo !== "por_asignar");
  const totalSobres = sobres.reduce((acc, s) => acc + s.saldoCentavos, 0);
  const dias = diasRestantesDelMes();

  const segmentos: SegmentoDona[] = sobresReales.map((s) => ({
    clave: String(s.id),
    nombre: s.nombre,
    valorCentavos: Math.max(s.saldoCentavos, 0),
    paso: pasoPorTipo[s.tipo] ?? 3,
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
            asignar a ningún sobre.
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
                avatar={<Avatar texto={iniciales(s.nombre)} />}
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
              avatar={<Avatar texto={iniciales(c.nombre)} />}
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

      {/* Últimos movimientos como tarjetas pálidas: solo en escritorio. */}
      <section className="hidden lg:col-span-7 lg:flex lg:flex-col lg:gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[16px] font-bold">Últimos movimientos</h2>
          <Link
            href="/movimientos"
            className="flex items-center gap-0.5 text-[13px] font-semibold text-enlace hover:text-texto"
          >
            Ver todos
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {recientes.map((m) => (
            <TarjetaMovimiento key={m.id} m={m} />
          ))}
        </div>
      </section>
    </main>
  );
}
