import type { ChangeEvent, ReactNode } from "react";
import { leerExacto, partesCentavos } from "@/lib/dinero";
import { campoDeAsignacion } from "@/lib/ingresos";
import { Entrada, ErrorCampo } from "./formulario";
import { EncabezadoTarjeta, TarjetaPalida } from "./ui";

/** Una fila del reparto: el sobre, su pista ("fijo · faltan 250 este mes", "40 %") y lo que se le asigna. */
export type FilaReparto = { sobreId: number; nombre: string; pista: string; valor: string; error?: string };

const numero = (centavos: number) => partesCentavos(centavos).numero;

/** "Repartido 1.200,00 de 1.200,00", "Quedan 50,00 en Por asignar" o, si se pasa, en rojo. */
function Pie({ montoCentavos, filas }: { montoCentavos: number | null; filas: FilaReparto[] }) {
  const clase = "text-[13px] font-semibold";
  if (montoCentavos === null) {
    return <p className={`${clase} text-palida-texto-2`}>Escribe el monto para ver el reparto.</p>;
  }
  let repartido = 0;
  for (const f of filas) {
    const leido = leerExacto(f.valor);
    if (leido.ok && leido.valor >= 0) repartido += leido.valor;
    else if (leido.ok || leido.motivo !== "vacio") {
      return <p className={`${clase} text-negativo`}>Revisa los montos marcados.</p>;
    }
  }
  if (repartido > montoCentavos) {
    return (
      <p className={`${clase} text-negativo`}>
        Repartes {numero(repartido)} y hay {numero(montoCentavos)}
      </p>
    );
  }
  if (repartido < montoCentavos) {
    return <p className={`${clase} text-palida-texto`}>Quedan {numero(montoCentavos - repartido)} en Por asignar</p>;
  }
  return (
    <p className={`${clase} text-palida-texto`}>
      Repartido {numero(repartido)} de {numero(montoCentavos)}
    </p>
  );
}

/**
 * El reparto de un ingreso o de lo que hay en "Por asignar" (spec 004): una fila por sobre con regla, con su pista y
 * un campo de monto que se puede cambiar, y un pie que suma lo escrito. Va dentro del formulario que lo envía; sin
 * JavaScript los campos se envían igual. `vacio` se muestra si no hay ninguna regla.
 */
export function TarjetaReparto({
  filas,
  montoCentavos,
  onCambio,
  error,
  enlace,
  vacio,
  className = "",
}: {
  filas: FilaReparto[];
  /** Lo que se reparte; null mientras el monto no se lee. */
  montoCentavos: number | null;
  onCambio?: (sobreId: number, valor: string) => void;
  /** El error del total, como una suma mayor que el monto. */
  error?: string;
  enlace?: { href: string; texto: string };
  vacio?: ReactNode;
  className?: string;
}) {
  return (
    <TarjetaPalida className={className}>
      <EncabezadoTarjeta titulo="Reparto" enlace={enlace} palida />
      {filas.length === 0 ? (
        <div className="text-[13px] text-palida-texto-2">{vacio}</div>
      ) : (
        <div className="flex flex-col">
          {filas.map((f) => (
            <div key={f.sobreId} className="flex flex-col gap-1 border-t border-palida-pista py-2.5 first:border-t-0">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-extrabold uppercase tracking-wide text-palida-texto">
                    {f.nombre}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-palida-texto-2">{f.pista}</span>
                </span>
                {/* El ancho va en un contenedor: Entrada trae w-full, que le ganaría a un w-32 en la misma clase. */}
                <span className="w-32 shrink-0">
                  <Entrada
                    name={campoDeAsignacion(f.sobreId)}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`Monto para ${f.nombre}`}
                    aria-invalid={f.error ? true : undefined}
                    {...(onCambio
                      ? {
                          value: f.valor,
                          onChange: (e: ChangeEvent<HTMLInputElement>) => onCambio(f.sobreId, e.target.value),
                        }
                      : { defaultValue: f.valor })}
                    className="tabular text-right font-bold"
                  />
                </span>
              </div>
              <ErrorCampo>{f.error}</ErrorCampo>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-col gap-1 border-t border-palida-pista pt-3">
        <Pie montoCentavos={montoCentavos} filas={filas} />
        <ErrorCampo>{error}</ErrorCampo>
      </div>
    </TarjetaPalida>
  );
}
