import { formatearCifra } from "./dinero";

/**
 * Retirar lo repartido (spec 007, criterio 11, decidido por el desarrollador: "que deshacer lo haga todo, con vista
 * previa"). "Por asignar" es una cuenta de lotes: cada entrada (un ingreso, un cobro, un Mover hacia él) es un lote, y
 * cada salida gasta de los lotes más viejos que aún tienen dinero, primero en entrar, primero en salir; el reparto
 * propio de un ingreso gasta de su propio lote. Deshacer un cobro o borrar un ingreso quita su lote, y con él lo que
 * se repartió con ese dinero (Repartir y Apartar): esas filas se borran o se achican. Así deshacer dos, en cualquier
 * orden, deja todo como si no hubieran pasado (sexta revisión, hallazgo 1). Lo que de ese lote salió de otra forma
 * (Mover, un préstamo) no se puede retirar: lo cubre lo libre de "Por asignar", y si no alcanza, no se deshace y se
 * dice. Lo retirado cuenta como reparto deshecho, así el reparto siguiente lo vuelve a pedir. La pantalla lo muestra
 * antes y solo se aplica al confirmar esa misma vista previa (la firma).
 */

/**
 * Qué es cada fila que mueve dinero de "Por asignar": una entrada; un reparto (Repartir o Apartar), que se puede
 * retirar; el reparto propio de un ingreso; un Mover hacia otro sobre; u otra salida (un préstamo, o una fila rara).
 */
export type Clase = "entrada" | "reparto" | "propio" | "mover" | "otra";

export type MovimientoDePorAsignar = {
  id: number;
  /** Con signo: lo que entra a "Por asignar" (+) o sale de él (−), en centavos de dólar. */
  centavos: number;
  clase: Clase;
  /** A qué sobre sale, en un reparto o un Mover. */
  sobreId: number | null;
  nombre: string | null;
  /** En el reparto propio de un ingreso, el id de ese ingreso, de cuyo lote sale. */
  ingresoId: number | null;
};

export type Retiro = { id: number; sobreId: number; nombre: string; centavos: number; borra: boolean };

/** Lo que de un lote salió de una forma que no se puede retirar. */
export type Salida = { clase: "mover" | "otra"; nombre: string | null; centavos: number };

export type PlanDeRetiro = { alcanza: true; retiros: Retiro[] } | { alcanza: false; faltan: number; salidas: Salida[] };

type Gasto = { lote: number; salida: MovimientoDePorAsignar; centavos: number };

/**
 * La cuenta de lotes: cuánto le queda a cada lote y qué salidas gastaron de él. Lo que sale sin lote que lo pague deja
 * "Por asignar" en negativo, y la entrada siguiente lo tapa antes de quedar libre: así lo que les queda a los lotes es
 * siempre el saldo, también después de deshacer algo que se había movido (sexta revisión).
 */
export function cuentaDeLotes(movimientos: MovimientoDePorAsignar[]) {
  const lotes: { id: number; restante: number }[] = [];
  const porId = new Map<number, { id: number; restante: number }>();
  const gastos: Gasto[] = [];
  let primero = 0;
  /** Lo que salió sin lote, en orden: la entrada siguiente lo paga primero. */
  const sinLote: { salida: MovimientoDePorAsignar; resta: number }[] = [];
  const tomar = (lote: { id: number; restante: number }, salida: MovimientoDePorAsignar, quiere: number) => {
    const centavos = Math.min(quiere, lote.restante);
    if (centavos <= 0) return 0;
    lote.restante -= centavos;
    gastos.push({ lote: lote.id, salida, centavos });
    return centavos;
  };
  for (const m of [...movimientos].sort((a, b) => a.id - b.id)) {
    if (m.centavos > 0) {
      const lote = { id: m.id, restante: m.centavos };
      while (lote.restante > 0 && sinLote.length > 0) {
        sinLote[0].resta -= tomar(lote, sinLote[0].salida, sinLote[0].resta);
        if (sinLote[0].resta === 0) sinLote.shift();
      }
      lotes.push(lote);
      porId.set(m.id, lote);
      continue;
    }
    let resta = -m.centavos;
    const propio = m.clase === "propio" && m.ingresoId !== null ? porId.get(m.ingresoId) : undefined;
    if (propio) resta -= tomar(propio, m, resta);
    while (resta > 0 && primero < lotes.length) {
      if (lotes[primero].restante === 0) primero++;
      else resta -= tomar(lotes[primero], m, resta);
    }
    if (resta > 0) sinLote.push({ salida: m, resta });
  }
  return { restante: (id: number) => porId.get(id)?.restante ?? 0, existe: (id: number) => porId.has(id), gastos };
}

/**
 * El plan de quitar el lote `loteId` con lo que se repartió con él. `saldoCentavos` es el saldo de "Por asignar": lo
 * que no es de este lote es lo libre que puede cubrir lo que salió de otra forma.
 */
export function planDeRetiro(
  movimientos: MovimientoDePorAsignar[],
  loteId: number,
  saldoCentavos: number,
): PlanDeRetiro {
  const cuenta = cuentaDeLotes(movimientos);
  const delLote = cuenta.gastos.filter((g) => g.lote === loteId);
  const retiros = delLote
    .filter((g) => g.salida.clase === "reparto" && g.salida.sobreId !== null)
    .map((g) => ({
      id: g.salida.id,
      sobreId: g.salida.sobreId as number,
      nombre: g.salida.nombre ?? "?",
      centavos: g.centavos,
      borra: g.centavos === -g.salida.centavos,
    }));
  // El reparto propio del ingreso que se borra se va con él; el de otro ingreso que gastó de este lote, no se toca.
  const fuera = delLote.filter(
    (g) =>
      g.salida.clase === "mover" ||
      g.salida.clase === "otra" ||
      (g.salida.clase === "propio" && g.salida.ingresoId !== loteId),
  );
  const totalFuera = fuera.reduce((a, g) => a + g.centavos, 0);
  const libre = Math.max(0, saldoCentavos - cuenta.restante(loteId));
  if (totalFuera > libre) {
    const salidas = new Map<string, Salida>();
    for (const g of fuera) {
      const clase = g.salida.clase === "mover" ? "mover" : "otra";
      const clave = `${clase}:${clase === "mover" ? g.salida.sobreId : ""}`;
      const previa = salidas.get(clave);
      salidas.set(clave, {
        clase,
        nombre: clase === "mover" ? g.salida.nombre : null,
        centavos: (previa?.centavos ?? 0) + g.centavos,
      });
    }
    return { alcanza: false, faltan: totalFuera - libre, salidas: [...salidas.values()] };
  }
  return { alcanza: true, retiros };
}

/**
 * Por qué no se puede: de este dinero salió algo con Mover o de otra forma, y lo libre de "Por asignar" no lo cubre.
 * Dice adónde fue lo de Mover, para devolverlo de ahí: Mover no cuenta como reparto en ninguno de los dos sentidos.
 */
export function noAlcanzaElRetiro(nombre: string, plan: { faltan: number; salidas: Salida[] }) {
  const partes = plan.salidas.map((s) =>
    s.clase === "mover"
      ? `${formatearCifra(s.centavos)} con Mover a ${s.nombre}`
      : `${formatearCifra(s.centavos)} de otra forma (un préstamo, o al bajar otro ingreso)`,
  );
  const faltan = formatearCifra(plan.faltan);
  const soloMover = plan.salidas.every((s) => s.clase === "mover");
  const desde = soloMover ? ` desde ${plan.salidas.map((s) => s.nombre).join(" o ")}` : "";
  return `De este dinero salieron ${partes.join(" y ")}, y ${nombre} no tiene con qué cubrirlo: faltan ${faltan}. Devuelve ${faltan} a ${nombre} con Mover${desde} y vuelve a intentarlo.`;
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

/** Qué filas y cuánto de cada una. */
export function firmaDeRetiro(retiros: Retiro[]): string {
  return retiros.map((r) => `${r.id}:${r.centavos}`).join(",");
}

/**
 * Lo que identifica una vista previa: qué filas, cuánto de cada una y los saldos que se vieron antes. Si algo de eso
 * cambia, hay que volver a mostrarla (guardian-datos, hallazgo 2; sexta revisión, hallazgo 3).
 */
export function firmaDeVista(retiros: Retiro[], saldos: SaldoQueQueda[]): string {
  return `${firmaDeRetiro(retiros)}|${saldos.map((x) => x.antes).join(",")}`;
}
