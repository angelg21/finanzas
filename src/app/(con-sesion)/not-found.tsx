import { EnlaceBoton } from "@/components/formulario";
import { Tarjeta } from "@/components/ui";

/**
 * Lo que no existe dentro de la app: un movimiento ya borrado (al volver atrás después de borrarlo), una deuda o un
 * sobre que no está. En español y con la navegación, en vez del 404 de Next en inglés (revisión de la 006, hallazgo 5).
 */
export default function NoEncontrado() {
  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <Tarjeta className="flex flex-col gap-3 lg:col-span-6 lg:col-start-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">No está</h1>
        <p className="text-[14px] text-texto-2">Lo que buscas no existe, o ya se borró.</p>
        <div className="flex flex-wrap gap-2">
          <EnlaceBoton href="/movimientos">Ir a Movimientos</EnlaceBoton>
          <EnlaceBoton href="/" variante="secundario">
            Ir al inicio
          </EnlaceBoton>
        </div>
      </Tarjeta>
    </main>
  );
}
