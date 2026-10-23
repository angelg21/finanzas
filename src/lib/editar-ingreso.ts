/**
 * Editar o borrar un ingreso (spec 006, criterios 4, 5 y 7). Editar vuelve a preparar la fila con las reglas de la
 * captura (monto, cuenta en dólares, fecha) y la diferencia de monto entra o sale del sobre que lo recibió, "Por
 * asignar"; su reparto no cambia. Bajarlo solo se puede si ese sobre alcanza: el reparto ya se llevó lo demás.
 * Borrarlo se lleva su reparto: el sobre destino pierde lo que quedó sin repartir y cada sobre devuelve lo suyo. Si
 * el destino ya no lo tiene, lo que falta se retira del reparto posterior (spec 007, criterio 11).
 */
import { formatearCifra } from "./dinero";
import { type CuentaIngreso, type ErroresIngreso, type FilaIngreso, prepararIngreso } from "./ingresos";

/** Lo guardado del ingreso: su fila, lo que valía y el sobre que lo recibió. */
export type IngresoGuardado = { id: number; montoUsdCentavos: number; sobreDestinoId: number };

export type EdicionDeIngreso = { monto: string; fecha: string; nota: string; categoriaId: number };

export type PlanDeIngreso =
  { ok: true; fila: FilaIngreso; diferencia: number } | { ok: false; errores: ErroresIngreso };

export function planDeEdicionDeIngreso(
  guardado: IngresoGuardado,
  nueva: EdicionDeIngreso,
  cuenta: CuentaIngreso | null,
  saldoDestinoCentavos: number,
  hoy: string,
): PlanDeIngreso {
  // Sin reparto: se prepara como un ingreso que queda entero en su sobre, y de ahí sale solo su fila.
  const preparado = prepararIngreso(
    { ...nueva, porAsignarId: guardado.sobreDestinoId, sobresValidos: [], asignaciones: [] },
    hoy,
    cuenta,
  );
  if (!preparado.ok) return preparado;
  const [fila] = preparado.filas;
  const diferencia = fila.montoUsdCentavos - guardado.montoUsdCentavos;
  if (saldoDestinoCentavos + diferencia < 0) {
    return {
      ok: false,
      errores: {
        monto: `Por asignar tiene ${formatearCifra(saldoDestinoCentavos)}; para bajar ${formatearCifra(-diferencia)}, borra el ingreso con su reparto y regístralo de nuevo`,
      },
    };
  }
  return { ok: true, fila, diferencia };
}

export type RepartoGuardado = { sobreId: number; nombre: string; montoUsdCentavos: number; saldoCentavos: number };

export type PlanDeBorrado = { ok: true; avisos: string[] } | { ok: false; error: string };

type EntradaBorrado = {
  montoUsdCentavos: number;
  destino: { nombre: string; saldoCentavos: number };
  reparto: RepartoGuardado[];
  /** Lo que se retira del reparto posterior para cubrir lo que falta (spec 007, criterio 11), con el saldo de cada sobre. */
  retirado?: RepartoGuardado[];
};

const suma = (filas: RepartoGuardado[]) => filas.reduce((a, r) => a + r.montoUsdCentavos, 0);

/** Lo que le falta al sobre destino para borrar el ingreso con su reparto; 0 si lo tiene. */
export function faltaParaBorrar(e: EntradaBorrado): number {
  return Math.max(0, e.montoUsdCentavos - suma(e.reparto) - e.destino.saldoCentavos);
}

export function planDeBorradoDeIngreso(e: EntradaBorrado): PlanDeBorrado {
  const retirado = e.retirado ?? [];
  const quedaDestino = e.destino.saldoCentavos - e.montoUsdCentavos + suma(e.reparto) + suma(retirado);
  if (quedaDestino < 0) {
    return {
      ok: false,
      error: `${e.destino.nombre} tiene ${formatearCifra(e.destino.saldoCentavos)}; le faltan ${formatearCifra(-quedaDestino)}`,
    };
  }
  // Un sobre que ya gastó lo recibido queda en negativo, como con un gasto: se avisa antes de confirmar.
  const porSobre = new Map<number, RepartoGuardado & { devuelve: number }>();
  for (const r of [...e.reparto, ...retirado]) {
    const previo = porSobre.get(r.sobreId);
    porSobre.set(r.sobreId, { ...r, devuelve: (previo?.devuelve ?? 0) + r.montoUsdCentavos });
  }
  const avisos = [...porSobre.values()]
    .filter((r) => r.saldoCentavos - r.devuelve < 0)
    .map((r) => `${r.nombre} quedará en ${formatearCifra(r.saldoCentavos - r.devuelve)}`);
  return { ok: true, avisos };
}
