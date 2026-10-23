import { formatearCifra } from "./dinero";

/**
 * Retirar lo repartido (spec 007, criterio 11, decidido por el desarrollador). Deshacer un cobro o borrar un ingreso
 * saca dinero de "Por asignar"; si ya se repartió, lo que falta se retira de lo que se repartió después desde "Por
 * asignar" (Repartir, el reparto de un ingreso posterior y Apartar), del más reciente al más viejo: los que caben
 * enteros se borran y el último se achica. Lo retirado cuenta como reparto deshecho, así el reparto siguiente lo
 * vuelve a pedir. La pantalla lo muestra antes y solo se aplica al confirmar esa misma vista previa (la firma).
 */

/** Una reasignación desde "Por asignar" que es reparto, posterior a lo que se deshace, con su monto en centavos. */
export type RepartoPosterior = { id: number; sobreId: number; nombre: string; montoCentavos: number };

export type Retiro = { id: number; sobreId: number; nombre: string; centavos: number; borra: boolean };

export type PlanDeRetiro =
  | { alcanza: true; retiros: Retiro[] }
  /** Lo repartido después no cubre lo que falta: el resto salió de "Por asignar" de otra forma (Mover, un préstamo). */
  | { alcanza: false; faltan: number; alcanzaHasta: number };

/** `posteriores`, del más reciente al más viejo. */
export function planDeRetiro(faltan: number, posteriores: RepartoPosterior[]): PlanDeRetiro {
  if (faltan <= 0) return { alcanza: true, retiros: [] };
  const retiros: Retiro[] = [];
  let resta = faltan;
  for (const r of posteriores) {
    if (resta === 0) break;
    const centavos = Math.min(resta, r.montoCentavos);
    retiros.push({ id: r.id, sobreId: r.sobreId, nombre: r.nombre, centavos, borra: centavos === r.montoCentavos });
    resta -= centavos;
  }
  if (resta > 0) return { alcanza: false, faltan, alcanzaHasta: faltan - resta };
  return { alcanza: true, retiros };
}

/**
 * Por qué no se puede ni retirando lo repartido: lo que falta salió de "Por asignar" con Mover o con un préstamo, que
 * no son reparto. Dice cuánto devolver con Mover para que alcance.
 */
export function noAlcanzaElRetiro(
  nombre: string,
  saldoCentavos: number,
  plan: { faltan: number; alcanzaHasta: number },
) {
  const loDemas = formatearCifra(plan.faltan - plan.alcanzaHasta);
  return `${nombre} tiene ${formatearCifra(saldoCentavos)}; le faltan ${formatearCifra(plan.faltan)}, y lo repartido después solo cubre ${formatearCifra(plan.alcanzaHasta)}: lo demás salió con Mover o con un préstamo. Devuelve ${loDemas} a ${nombre} con Mover y vuelve a intentarlo.`;
}

/** Lo que cambia en un sobre, en centavos con signo. */
export type Cambio = { sobreId: number; nombre: string; centavos: number };

/** Junta lo que cambia en cada sobre, en el orden en que aparece, para mostrarlo en la vista previa. */
export function juntarPorSobre(cambios: Cambio[]): Cambio[] {
  const porSobre = new Map<number, Cambio>();
  for (const c of cambios) {
    const previo = porSobre.get(c.sobreId);
    porSobre.set(c.sobreId, { sobreId: c.sobreId, nombre: c.nombre, centavos: (previo?.centavos ?? 0) + c.centavos });
  }
  return [...porSobre.values()];
}

/**
 * Cómo cambia cada sobre al deshacer: "Por asignar" pierde `sale` y recupera lo que devuelven el reparto propio y los
 * retiros; cada uno de esos sobres pierde lo suyo. "Por asignar" va primero.
 */
export function cambiosPorSobre(
  porAsignar: { sobreId: number; nombre: string },
  sale: number,
  devuelven: Cambio[],
  retiros: Retiro[],
): Cambio[] {
  const vuelven = [...devuelven, ...retiros.map(({ sobreId, nombre, centavos }) => ({ sobreId, nombre, centavos }))];
  const recupera = vuelven.reduce((a, c) => a + c.centavos, 0);
  return juntarPorSobre([
    { ...porAsignar, centavos: recupera - sale },
    ...vuelven.map((c) => ({ ...c, centavos: -c.centavos })),
  ]);
}

/** Un saldo antes y después; la moneda solo en la cuenta, los sobres van en dólares. */
export type SaldoQueQueda = { nombre: string; antes: number; despues: number; moneda: string | null };

/**
 * La vista previa de deshacer un cobro o borrar un ingreso: lo que se retira de cada sobre, cómo quedan la cuenta y
 * cada sobre tocado, y la firma del plan que se confirma.
 */
export type VistaPrevia = { firma: string; retirado: Cambio[]; saldos: SaldoQueQueda[] };

/** Lo que identifica una vista previa: qué filas y cuánto de cada una. Si cambia, hay que volver a mostrarla. */
export function firmaDeRetiro(retiros: Retiro[]): string {
  return retiros.map((r) => `${r.id}:${r.centavos}`).join(",");
}
