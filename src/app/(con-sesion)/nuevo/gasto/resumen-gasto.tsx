import { CheckCircle2, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { EnlaceBoton } from "@/components/formulario";
import { Cifra, Pildora, Tarjeta } from "@/components/ui";
import { formatearCentavos } from "@/lib/dinero";
import type { FormaPago } from "@/lib/gastos";
import type { ResumenGasto as Resumen } from "./acciones";

/**
 * Estado de éxito (criterio 13): lo registrado, el aviso de sobre negativo (10), el de Bolívares en
 * negativo (4) o el del vuelto de una venta (2), y dos salidas. "Registrar otro" es un enlace para que
 * funcione sin JavaScript; con él, reabre el formulario en el sitio con la misma forma de pago y las mismas
 * cuentas.
 */
export function ResumenGasto({
  resumen,
  forma,
  cuentaId,
  cuentaVentaId,
  alRegistrarOtro,
}: {
  resumen: Resumen;
  forma: FormaPago;
  cuentaId: string;
  cuentaVentaId: string;
  alRegistrarOtro: () => void;
}) {
  const { montoCentavos, moneda, montoUsdCentavos, categoria, cuenta, sobre, venta } = resumen;
  const bolivares = resumen.bolivaresDespuesCentavos;

  return (
    <Tarjeta className="lg:col-span-7">
      <div role="status" className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-positivo">
          <CheckCircle2 size={18} aria-hidden />
          Gasto registrado
        </p>
        <div className="flex flex-col gap-1">
          <Cifra centavos={montoCentavos} moneda={moneda} tamano="xl" />
          {moneda === "VES" ? <Cifra centavos={montoUsdCentavos} tamano="sm" tono="texto-3" /> : null}
        </div>
        <p className="text-[15px] text-texto-2">
          {formatearCentavos(montoCentavos, moneda)} en {categoria} desde {cuenta}
          {/* La cuenta de la venta, a la vista: si no era la que se quería, se nota aquí. */}
          {venta ? `, con ${formatearCentavos(venta.montoCentavos, venta.moneda)} vendidos de ${venta.cuenta}` : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Pildora tono="palida">{categoria}</Pildora>
          <Pildora>{cuenta}</Pildora>
          <Pildora>{sobre}</Pildora>
        </div>

        {resumen.sobreDespuesCentavos < 0 ? (
          <Aviso>
            {sobre} queda en {formatearCentavos(resumen.sobreDespuesCentavos)}; reasigna desde otro sobre.
          </Aviso>
        ) : null}
        {bolivares !== null && bolivares < 0 ? (
          <Aviso>
            Bolívares queda en {formatearCentavos(bolivares, "VES")}. Revisa el monto o registra la venta que falta.
          </Aviso>
        ) : null}
        {/* Solo hay vuelto si se vendieron dólares para este gasto; del saldo, no. */}
        {venta && venta.vueltoCentavos > 0 && bolivares !== null ? (
          <p className="text-[13px] text-texto-2">
            Te quedan {formatearCentavos(venta.vueltoCentavos, "VES")} de vuelto; Bolívares queda en{" "}
            {formatearCentavos(bolivares, "VES")}.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <EnlaceBoton
            href={`/nuevo/gasto?forma=${forma}&cuenta=${cuentaId}&venta=${cuentaVentaId}`}
            onClick={(e) => {
              e.preventDefault();
              alRegistrarOtro();
            }}
            autoFocus
            className="sm:flex-1"
          >
            Registrar otro
          </EnlaceBoton>
          <EnlaceBoton href="/" variante="secundario" className="sm:flex-1">
            Ir al inicio
          </EnlaceBoton>
        </div>
      </div>
    </Tarjeta>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] font-semibold text-negativo">
      <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
