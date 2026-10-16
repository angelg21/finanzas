import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  HandHelping,
  Shuffle,
} from "lucide-react";
import type { MovimientoReciente } from "@/db/consultas";
import { formatearCentavos, formatearTasaGuardada } from "@/lib/dinero";
import { Cifra, CirculoCategoria } from "./ui";

const etiquetaTipo: Record<MovimientoReciente["tipo"], string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  transferencia: "Transferencia",
  reasignacion: "Reasignación",
  pago_deuda: "Pago de deuda",
  prestamo: "Préstamo",
  cobro_prestamo: "Cobro de préstamo",
};

const iconoTipo = {
  ingreso: ArrowDownLeft,
  gasto: ArrowUpRight,
  transferencia: ArrowLeftRight,
  reasignacion: Shuffle,
  pago_deuda: BanknoteArrowUp,
  prestamo: HandHelping,
  cobro_prestamo: BanknoteArrowDown,
} as const;

/**
 * Un movimiento como fila de lista (spec 003), en /movimientos y en los últimos movimientos del inicio: el círculo de
 * su categoría primero, la nota o la categoría, debajo el detalle, y el monto en USD a la derecha. Un gasto en
 * bolívares muestra también los Bs y la tasa. Las transferencias y reasignaciones llevan un círculo neutro y
 * "origen → destino".
 */
export function FilaMovimiento({ m }: { m: MovimientoReciente }) {
  const Icono = iconoTipo[m.tipo];
  const esMover = m.tipo === "transferencia" || m.tipo === "reasignacion";
  const titulo =
    m.tipo === "transferencia"
      ? `${m.cuentaOrigen ?? "?"} → ${m.cuentaDestino ?? "?"}`
      : m.tipo === "reasignacion"
        ? `${m.sobreOrigen ?? "?"} → ${m.sobreDestino ?? "?"}`
        : (m.nota ?? m.categoria ?? etiquetaTipo[m.tipo]);
  const detalle = esMover
    ? [etiquetaTipo[m.tipo], m.nota]
    : [m.nota ? m.categoria : null, m.tipo === "gasto" ? m.cuentaOrigen : m.cuentaDestino];

  return (
    <div className="flex items-center gap-3 py-3">
      {esMover ? (
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-pildora-oscura text-pildora-oscura-texto"
        >
          <Icono size={19} strokeWidth={1.75} />
        </span>
      ) : (
        <CirculoCategoria icono={m.categoriaIcono ?? ""} color={m.categoriaColor ?? ""} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{titulo}</span>
        <span className="mt-0.5 block truncate text-[13px] text-texto-3">{detalle.filter(Boolean).join(" · ")}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {m.tipo === "gasto" ? (
          <Cifra centavos={-m.montoUsdCentavos} />
        ) : m.tipo === "ingreso" ? (
          <Cifra centavos={m.montoUsdCentavos} tono="positivo" signo />
        ) : (
          <Cifra centavos={m.montoCentavos} moneda={m.moneda} />
        )}
        {m.moneda === "VES" && !esMover ? (
          <span className="tabular text-[12px] text-texto-3">
            {formatearCentavos(m.montoCentavos, "VES")}
            {m.tasa ? ` · ${formatearTasaGuardada(m.tasa)}` : ""}
          </span>
        ) : null}
        {m.tipo === "transferencia" && m.montoDestinoCentavos !== null && m.monedaDestino ? (
          <span className="tabular text-[12px] text-texto-3">
            recibe {formatearCentavos(m.montoDestinoCentavos, m.monedaDestino)}
          </span>
        ) : null}
      </span>
    </div>
  );
}
