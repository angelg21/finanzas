import { CircleAlert } from "lucide-react";
import { Cifra, EncabezadoTarjeta, Progreso, TarjetaPalida } from "@/components/ui";
import type { Moneda } from "@/lib/dinero";
import { type FormaPago, prepararGasto } from "@/lib/gastos";
import { saldosTras } from "@/lib/saldos";

export type SaldoAfectado = {
  nombre: string;
  moneda: Moneda;
  antesCentavos: number;
  despuesCentavos: number;
  topeCentavos?: number | null;
};

type Cuenta = { id: number; nombre: string; moneda: Moneda; saldoCentavos: number };
type Sobre = { id: number; nombre: string; saldoCentavos: number; topeCentavos: number | null };

/**
 * El sobre y las cuentas que tocaría el gasto que se está escribiendo, antes y después. Usa las mismas
 * funciones que la acción (prepararGasto y saldosTras), así que lo que se ve es lo que se guardará.
 * Mientras el formulario no tiene un gasto válido, antes y después coinciden.
 */
export function saldosAfectados(p: {
  forma: FormaPago;
  monto: string;
  tasa: string;
  vendido: string;
  cuentaId: string;
  sobreId: string;
  cuentas: Cuenta[];
  sobres: Sobre[];
  hoy: string;
}) {
  const origen = p.cuentas.find((c) => String(c.id) === p.cuentaId && c.moneda !== "VES");
  const bolivares = p.cuentas.find((c) => c.moneda === "VES") ?? null;
  const sobre = p.sobres.find((s) => String(s.id) === p.sobreId) ?? null;
  const preparado = prepararGasto(
    {
      forma: p.forma,
      monto: p.monto,
      tasa: p.tasa,
      vendido: p.vendido,
      cuentaOrigen: origen ?? { id: 0, moneda: "VES" },
      cuentaBolivares: bolivares,
      sobreId: sobre?.id ?? 0,
      categoriaId: 0,
      fecha: p.hoy,
      nota: "",
    },
    p.hoy,
  );
  const despues = saldosTras(
    preparado.ok ? preparado.filas : [],
    Object.fromEntries(p.cuentas.map((c) => [c.id, c.saldoCentavos])),
    sobre ? { [sobre.id]: sobre.saldoCentavos } : {},
  );
  const tocadas = [p.forma !== "saldo" ? origen : undefined, p.forma !== "dolares" ? bolivares : undefined];

  return {
    sobre: sobre
      ? {
          nombre: sobre.nombre,
          moneda: "USD" as const,
          antesCentavos: sobre.saldoCentavos,
          despuesCentavos: despues.sobres[sobre.id],
          topeCentavos: sobre.topeCentavos,
        }
      : null,
    cuentas: tocadas
      .filter((c) => c !== undefined && c !== null)
      .map((c) => ({
        nombre: c.nombre,
        moneda: c.moneda,
        antesCentavos: c.saldoCentavos,
        despuesCentavos: despues.cuentas[c.id],
      })),
  };
}

/**
 * Escritorio: el sobre y las cuentas que toca el gasto, con su saldo actual y el que les queda.
 * Sin JavaScript, o mientras el formulario no tiene un gasto válido, antes y después coinciden.
 */
export function AntesYDespues({ sobre, cuentas }: { sobre: SaldoAfectado | null; cuentas: SaldoAfectado[] }) {
  const afectados = sobre ? [sobre, ...cuentas] : cuentas;
  return (
    <TarjetaPalida className="hidden lg:col-span-5 lg:block">
      <EncabezadoTarjeta titulo="Antes y después" palida />
      <div className="flex flex-col gap-4">
        {afectados.map((a) => (
          <Fila key={a.nombre} {...a} />
        ))}
      </div>
    </TarjetaPalida>
  );
}

function Fila({ nombre, moneda, antesCentavos, despuesCentavos, topeCentavos }: SaldoAfectado) {
  const negativo = despuesCentavos < 0;
  return (
    <div className="flex flex-col gap-2 border-t border-palida-pista pt-3">
      <p className="text-[13px] font-extrabold uppercase tracking-wide text-palida-texto">{nombre}</p>
      <p className="flex items-baseline justify-between gap-3 text-[12px] font-semibold text-palida-texto-2">
        Ahora
        <Cifra centavos={antesCentavos} moneda={moneda} tono="palida-2" />
      </p>
      <p className="flex items-baseline justify-between gap-3 text-[12px] font-semibold text-palida-texto-2">
        Después del gasto
        <Cifra centavos={despuesCentavos} moneda={moneda} tamano="lg" tono={negativo ? "palida-negativo" : "palida"} />
      </p>
      {topeCentavos ? <Progreso valor={despuesCentavos / topeCentavos} palida /> : null}
      {negativo ? (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-palida-negativo">
          <CircleAlert size={14} aria-hidden />
          Queda en negativo
        </p>
      ) : null}
    </div>
  );
}
