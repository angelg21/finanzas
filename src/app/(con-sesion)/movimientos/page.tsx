import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, PiggyBank } from "lucide-react";
import { TarjetaMovimiento } from "@/components/movimiento";
import { Cifra, Tarjeta, TituloPagina } from "@/components/ui";
import { movimientosRecientes, type MovimientoReciente } from "@/db/consultas";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Movimientos" };
export const dynamic = "force-dynamic";

function etiquetaFecha(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const mismo = (x: Date, y: Date) =>
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
  if (mismo(fecha, hoy)) return "Hoy";
  if (mismo(fecha, ayer)) return "Ayer";
  const texto = new Intl.DateTimeFormat("es-VE", { weekday: "long", day: "numeric", month: "long" }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Resumen({
  icono,
  etiqueta,
  children,
  className = "",
}: {
  icono: React.ReactNode;
  etiqueta: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tarjeta className={className}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-texto-3">
        {icono}
        {etiqueta}
      </div>
      {children}
    </Tarjeta>
  );
}

export default async function Movimientos() {
  await exigirSesion();
  const movimientos = await movimientosRecientes(60);

  const grupos = new Map<string, MovimientoReciente[]>();
  for (const m of movimientos) {
    const lista = grupos.get(m.fecha) ?? [];
    lista.push(m);
    grupos.set(m.fecha, lista);
  }

  const totalGastos = movimientos.filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.montoUsdCentavos, 0);
  const totalIngresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.montoUsdCentavos, 0);

  return (
    <main className="flex flex-col gap-4 lg:gap-5">
      <TituloPagina titulo="Movimientos" detalle={`${movimientos.length} recientes`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5">
        <Resumen icono={<ArrowDownLeft size={14} aria-hidden />} etiqueta="Ingresos">
          <Cifra centavos={totalIngresos} tamano="lg" tono="positivo" />
        </Resumen>
        <Resumen icono={<ArrowUpRight size={14} aria-hidden />} etiqueta="Gastos">
          <Cifra centavos={-totalGastos} tamano="lg" />
        </Resumen>
        <Resumen icono={<PiggyBank size={14} aria-hidden />} etiqueta="Ahorrado" className="hidden lg:block">
          <Cifra centavos={totalIngresos - totalGastos} tamano="lg" tono="palido" />
        </Resumen>
      </div>

      {movimientos.length === 0 ? (
        <Tarjeta>
          <p className="text-texto-2">Todavía no hay movimientos. Registra el primero con el botón central.</p>
        </Tarjeta>
      ) : (
        [...grupos.entries()].map(([fecha, lista]) => (
          <section key={fecha}>
            <h2 className="mb-2 px-1 text-[13px] font-bold text-texto-3 lg:text-[14px]">{etiquetaFecha(fecha)}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 lg:gap-4">
              {lista.map((m) => (
                <TarjetaMovimiento key={m.id} m={m} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
