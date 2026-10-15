import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, Shuffle, Wallet } from "lucide-react";
import type { MovimientoReciente } from "@/db/consultas";
import { formatearCentavos, formatearTasaGuardada } from "@/lib/dinero";
import { Cifra, CirculoCategoria, Dato, Pildora, TarjetaPalida } from "./ui";

/*
  Tarjeta pálida de un movimiento, como las tarjetas "Invested" y "Withdraw" de la referencia:
  encabezado con el tipo y píldoras azul marino a la derecha, título, fila de píldoras
  con el monto y la categoría, y un pie con cuenta y sobre.
*/

const etiquetaTipo: Record<MovimientoReciente["tipo"], string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  transferencia: "Transferencia",
  reasignacion: "Reasignación",
};

const iconoTipo = {
  ingreso: ArrowDownLeft,
  gasto: ArrowUpRight,
  transferencia: ArrowLeftRight,
  reasignacion: Shuffle,
} as const;

function fechaCorta(iso: string) {
  return iso.split("-").reverse().join("-");
}

export function TarjetaMovimiento({ m }: { m: MovimientoReciente }) {
  const Icono = iconoTipo[m.tipo];
  const titulo = m.nota ?? m.categoria ?? etiquetaTipo[m.tipo];
  const cuenta = m.tipo === "ingreso" ? m.cuentaDestino : m.cuentaOrigen;
  const enBolivares = m.moneda === "VES";

  const montoPildora =
    m.tipo === "ingreso" ? (
      <Pildora tono="navy">
        <ArrowDownLeft size={13} aria-hidden />
        {formatearCentavos(m.montoUsdCentavos)}
      </Pildora>
    ) : m.tipo === "gasto" ? (
      <Pildora tono="navy">
        <ArrowUpRight size={13} aria-hidden />
        {formatearCentavos(-m.montoUsdCentavos)}
      </Pildora>
    ) : (
      <Pildora tono="navy">
        <Icono size={13} aria-hidden />
        {formatearCentavos(m.montoUsdCentavos)}
      </Pildora>
    );

  return (
    <TarjetaPalida className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-palida-texto">
          <Icono size={15} aria-hidden />
          {etiquetaTipo[m.tipo]}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Pildora tono="navy">
            <CalendarDays size={13} aria-hidden />
            {fechaCorta(m.fecha)}
          </Pildora>
          {cuenta ? (
            <Pildora tono="navy">
              <Wallet size={13} aria-hidden />
              {cuenta}
            </Pildora>
          ) : null}
        </span>
      </div>

      <h3 className="truncate text-[16px] font-bold text-palida-texto">{titulo}</h3>

      <div className="flex flex-wrap gap-1.5">
        {montoPildora}
        {m.categoria && m.nota ? <Pildora tono="blanca">{m.categoria}</Pildora> : null}
        {enBolivares ? (
          <Pildora tono="blanca">
            {formatearCentavos(m.montoCentavos, "VES")}
            {m.tasa ? ` · ${formatearTasaGuardada(m.tasa)}` : ""}
          </Pildora>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-palida-pista pt-3">
        {m.tipo === "gasto" ? <Dato etiqueta="Sobre">{m.sobreOrigen ?? "—"}</Dato> : null}
        {m.tipo === "ingreso" ? <Dato etiqueta="Sobre">{m.sobreDestino ?? "—"}</Dato> : null}
        {m.tipo === "transferencia" ? (
          <Dato etiqueta="Ruta">
            {m.cuentaOrigen ?? "?"} → {m.cuentaDestino ?? "?"}
          </Dato>
        ) : null}
        {m.tipo === "reasignacion" ? (
          <Dato etiqueta="Ruta">
            {m.sobreOrigen ?? "?"} → {m.sobreDestino ?? "?"}
          </Dato>
        ) : null}
        {m.tipo === "gasto" || m.tipo === "ingreso" ? <Dato etiqueta="Categoría">{m.categoria ?? "—"}</Dato> : null}
      </div>
    </TarjetaPalida>
  );
}

/**
 * Un movimiento como fila de lista (spec 003), para /movimientos: el círculo de su categoría primero, la nota o la
 * categoría, debajo el detalle, y el monto en USD a la derecha. Un gasto en bolívares muestra también los Bs y la
 * tasa. Las transferencias y reasignaciones llevan un círculo neutro y "origen → destino".
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
