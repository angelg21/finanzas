import { CheckCircle2 } from "lucide-react";
import { Pildora } from "@/components/ui";
import type { DeudaConPendiente } from "@/db/deudas";
import { cuentaParaPagar } from "@/lib/deudas";
import { type Moneda, centavosATexto } from "@/lib/dinero";
import { AvisoGuardado, FormularioPago, type Guardado } from "./formulario-pago";

type Datos = {
  deuda: Pick<DeudaConPendiente, "id" | "sentido" | "estado" | "pendienteCentavos" | "cuentaPrevistaId">;
  /** Los sobres desde los que se puede pagar, con su saldo: activos menos Por asignar (spec 014). */
  sobres: { id: number; nombre: string; tipo: string; saldoCentavos: number }[];
  /** Las categorías de gasto activas, por si el pago también cuenta como gasto (spec 014). */
  categorias: { id: number; nombre: string; icono: string; color: string }[];
  porAsignar: { activo: boolean } | null;
  /** Las cuentas activas: aquí se dejan las de dólares. */
  cuentas: { id: number; nombre: string; moneda: Moneda }[];
  hoy: string;
  /** Lo que se acaba de guardar, si se llega desde el guardado; /nuevo/deuda no lo pasa. */
  guardado?: Guardado;
};

/**
 * El formulario para pagar lo que debo o cobrar lo que me deben (spec 005, criterios 3 y 5), o por qué no se puede:
 * ya saldada, sin un sobre del que pagar o Por asignar activo, o sin cuentas en dólares. Lo comparten el detalle de la deuda y
 * /nuevo/deuda (criterio 23), con la misma acción: cada apertura es una captura nueva.
 */
export function Saldar({ deuda, sobres, categorias, porAsignar, cuentas, hoy, guardado }: Datos) {
  const debo = deuda.sentido === "debo";
  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  if (deuda.estado === "pagada") {
    // Sin formulario, el aviso de lo guardado no puede quedar viejo: va siempre que se llegue desde el guardado.
    return (
      <div className="flex flex-col gap-4">
        {guardado ? <AvisoGuardado guardado={guardado} /> : null}
        <div>
          <Pildora tono="positiva">
            <CheckCircle2 size={13} aria-hidden />
            {debo ? "Pagada" : "Cobrada"}
          </Pildora>
        </div>
      </div>
    );
  }
  const impedimento =
    debo && sobres.length === 0
      ? "No hay ningún sobre activo del que pagar."
      : !debo && !porAsignar?.activo
        ? "No hay un sobre Por asignar activo: no se puede cobrar."
        : enDolares.length === 0
          ? "No hay ninguna cuenta en dólares activa."
          : null;
  if (impedimento) return <p className="text-[13px] text-negativo">{impedimento}</p>;

  const cuentaInicial = cuentaParaPagar(deuda.cuentaPrevistaId, enDolares);
  // Deudas por defecto, que es para lo que se aparta (spec 014, criterio 1).
  const sobreInicial = sobres.find((s) => s.tipo === "deudas") ?? sobres[0];
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
        sobreId: debo && sobreInicial ? String(sobreInicial.id) : "",
        categoriaId: "",
        fecha: "hoy",
        nota: "",
      }}
      cuentas={enDolares.map(({ id, nombre, moneda }) => ({ id, nombre, moneda }))}
      hoy={hoy}
      sobres={debo ? sobres.map(({ id, nombre, saldoCentavos }) => ({ id, nombre, saldoCentavos })) : []}
      categorias={debo ? categorias : []}
      guardado={guardado}
    />
  );
}
