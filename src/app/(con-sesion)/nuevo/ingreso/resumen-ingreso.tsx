import { CheckCircle2 } from "lucide-react";
import { EnlaceBoton } from "@/components/formulario";
import { Cifra, Pildora, Tarjeta } from "@/components/ui";
import { formatearCentavos } from "@/lib/dinero";
import type { ResumenIngreso as Resumen } from "./valores";

/**
 * Estado de éxito: el ingreso, a dónde fue cada parte y, si quedó algo en "Por asignar", cuánto. "Registrar otro" es
 * un enlace para que funcione sin JavaScript; con él, reabre el formulario en el sitio con la misma cuenta.
 */
export function ResumenIngreso({
  resumen,
  cuentaId,
  alRegistrarOtro,
}: {
  resumen: Resumen;
  cuentaId: string;
  alRegistrarOtro: () => void;
}) {
  const { montoCentavos, moneda, cuenta, categoria, repartido, sinAsignarCentavos } = resumen;
  return (
    <Tarjeta className="lg:col-span-7">
      <div role="status" className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-positivo">
          <CheckCircle2 size={18} aria-hidden />
          Ingreso registrado
        </p>
        <Cifra centavos={montoCentavos} moneda={moneda} tamano="xl" />
        <p className="text-[15px] text-texto-2">
          {formatearCentavos(montoCentavos, moneda)} en {cuenta}, como {categoria}
        </p>
        <div className="flex flex-wrap gap-2">
          <Pildora tono="palida">{categoria}</Pildora>
          <Pildora>{cuenta}</Pildora>
        </div>

        {repartido.length > 0 ? (
          <ul className="flex flex-col divide-y divide-tarjeta-borde">
            {repartido.map((r) => (
              <li key={r.nombre} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-[13px] font-extrabold uppercase tracking-wide">{r.nombre}</span>
                <Cifra centavos={r.centavos} />
              </li>
            ))}
          </ul>
        ) : null}
        {sinAsignarCentavos > 0 ? (
          <p className="text-[13px] font-semibold text-texto-2">
            Quedan {formatearCentavos(sinAsignarCentavos)} en Por asignar.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <EnlaceBoton
            href={`/nuevo/ingreso?cuenta=${cuentaId}`}
            onClick={(e) => {
              e.preventDefault();
              alRegistrarOtro();
            }}
            autoFocus
            className="sm:flex-1"
          >
            Registrar otro
          </EnlaceBoton>
          <EnlaceBoton href="/sobres" variante="secundario" className="sm:flex-1">
            Ir a sobres
          </EnlaceBoton>
        </div>
      </div>
    </Tarjeta>
  );
}
