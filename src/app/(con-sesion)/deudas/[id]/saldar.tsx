import { CheckCircle2 } from "lucide-react";
import { Pildora } from "@/components/ui";
import type { DeudaConPendiente } from "@/db/deudas";
import { cuentaParaPagar } from "@/lib/deudas";
import { type Moneda, centavosATexto } from "@/lib/dinero";
import { FormularioPago } from "./formulario-pago";

type Datos = {
  deuda: Pick<DeudaConPendiente, "id" | "sentido" | "estado" | "pendienteCentavos" | "cuentaPrevistaId">;
  /** El sobre Deudas con su saldo, aunque esté inactivo, o null si no existe. */
  sobreDeudas: { activo: boolean; saldoCentavos: number } | null;
  porAsignar: { activo: boolean } | null;
  /** Las cuentas activas: aquí se dejan las de dólares. */
  cuentas: { id: number; nombre: string; moneda: Moneda }[];
  hoy: string;
};

/**
 * El formulario para pagar lo que debo o cobrar lo que me deben (spec 005, criterios 3 y 5), o por qué no se puede:
 * ya saldada, sin el sobre que hace falta activo o sin cuentas en dólares. Lo comparten el detalle de la deuda y
 * /nuevo/deuda (criterio 23), con la misma acción: cada apertura es una captura nueva.
 */
export function Saldar({ deuda, sobreDeudas, porAsignar, cuentas, hoy }: Datos) {
  const debo = deuda.sentido === "debo";
  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  if (deuda.estado === "pagada") {
    return (
      <Pildora tono="positiva">
        <CheckCircle2 size={13} aria-hidden />
        {debo ? "Pagada" : "Cobrada"}
      </Pildora>
    );
  }
  const impedimento =
    debo && !sobreDeudas?.activo
      ? "No hay un sobre Deudas activo: no se puede pagar."
      : !debo && !porAsignar?.activo
        ? "No hay un sobre Por asignar activo: no se puede cobrar."
        : enDolares.length === 0
          ? "No hay ninguna cuenta en dólares activa."
          : null;
  if (impedimento) return <p className="text-[13px] text-negativo">{impedimento}</p>;

  const cuentaInicial = cuentaParaPagar(deuda.cuentaPrevistaId, enDolares);
  return (
    // Con la deuda como clave, elegir otra en /nuevo/deuda empieza un formulario nuevo, con su pendiente escrito.
    <FormularioPago
      key={deuda.id}
      cual={debo ? "pago" : "cobro"}
      inicial={{
        deudaId: String(deuda.id),
        idCaptura: crypto.randomUUID(),
        monto: centavosATexto(deuda.pendienteCentavos),
        cuentaId: cuentaInicial === null ? "" : String(cuentaInicial),
        fecha: "hoy",
        nota: "",
      }}
      cuentas={enDolares.map(({ id, nombre, moneda }) => ({ id, nombre, moneda }))}
      hoy={hoy}
      saldoDeudasCentavos={debo && sobreDeudas ? sobreDeudas.saldoCentavos : null}
    />
  );
}
