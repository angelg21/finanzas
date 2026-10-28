import { formatearCifra } from "./dinero";

/**
 * Retirar lo hecho con un dinero (spec 007, criterio 11, decidido por el desarrollador: "que deshacer lo haga todo, con
 * vista previa"). "Por asignar" es una cuenta de lotes: cada cobro y cada ingreso es un lote, y lo que sale de él gasta
 * de los lotes más viejos, primero en entrar, primero en salir; el reparto propio de un ingreso, de su lote. Un Mover
 * de vuelta desde un sobre cancela antes los Mover que fueron a ese sobre: ir y volver no deja nada.
 *
 * Deshacer un cobro o borrar un ingreso quita su lote y todo lo que se hizo con él: lo repartido (Repartir y Apartar) y
 * lo movido a otro sobre; esas filas se borran o se achican. Lo que se prestó, o lo que usa el reparto de otro ingreso
 * que se bajó, no se puede retirar: entonces no se deshace, y se dice por qué. Como deshacer se lleva siempre todo lo
 * que usó su dinero, quitar un lote no cambia lo que gastaron los otros, y dos deshacer dejan lo mismo en cualquier
 * orden (sexta revisión y guardian-datos, 2026-10-23). Lo repartido que se retira cuenta como reparto deshecho, así el
 * reparto siguiente lo vuelve a pedir. La pantalla lo muestra antes y solo se aplica al confirmar esa misma vista
 * previa (la firma).
 */

/**
 * Qué es cada fila que mueve dinero de "Por asignar": la entrada de un cobro o un ingreso (un lote que se puede
 * deshacer); una vuelta (un Mover desde un sobre); un reparto (Repartir o Apartar); el reparto propio de un ingreso; un
 * Mover hacia un sobre; un préstamo; u otra salida (una fila rara).
 */
export type Clase = "entrada" | "vuelta" | "reparto" | "propio" | "mover" | "prestamo" | "otra";

export type MovimientoDePorAsignar = {
  id: number;
  /** Con signo: lo que entra a "Por asignar" (+) o sale de él (−), en centavos de dólar. */
  centavos: number;
  clase: Clase;
  /** El otro sobre: adónde va un reparto o un Mover, o de dónde viene una vuelta. */
  sobreId: number | null;
  nombre: string | null;
  /** En el reparto propio de un ingreso, el id de ese ingreso, de cuyo lote sale. */
  ingresoId: number | null;
};

export type Retiro = {
  id: number;
  sobreId: number;
  nombre: string;
  centavos: number;
  borra: boolean;
};

/** Lo que de un lote salió de una forma que no se puede retirar. */
export type Salida = {
  clase: "prestamo" | "propio" | "otra";
  centavos: number;
};

export type PlanDeRetiro = { alcanza: true; retiros: Retiro[] } | { alcanza: false; salidas: Salida[] };

type Lote = { id: number; restante: number };
type Gasto = { lote: number; salida: MovimientoDePorAsignar; centavos: number };
type Pendiente = { salida: MovimientoDePorAsignar; centavos: number };

/**
 * La cuenta de lotes. Primero, cada vuelta paga lo que fue con Mover a su sobre antes de ella, lo más viejo primero, y
 * cada ingreso aparta su reparto propio de su lote. Después, lo demás que sale, en el orden en que se registró, gasta
 * de los lotes y de lo que les quede a las vueltas, primero en entrar, primero en salir; una salida sin lote que la
 * pague la paga el lote siguiente. Devuelve lo que le queda a cada lote y qué salidas gastaron de él.
 */
export function cuentaDeLotes(movimientos: MovimientoDePorAsignar[]) {
  const orden = [...movimientos].sort((a, b) => a.id - b.id);
  const porId = new Map<number, Lote>();
  const lotes: Lote[] = [];
  const gastos: Gasto[] = [];
  const salidas: Pendiente[] = [];
  /** Lo que fue con Mover a cada sobre y todavía no volvió. */
  const sinVolver = new Map<number, Pendiente[]>();
  for (const m of orden) {
    if (m.centavos > 0) {
      const lote = { id: m.id, restante: m.centavos };
      porId.set(m.id, lote);
      lotes.push(lote);
      for (const ida of m.clase === "vuelta" && m.sobreId !== null ? (sinVolver.get(m.sobreId) ?? []) : []) {
        const centavos = Math.min(ida.centavos, lote.restante);
        if (centavos === 0) break;
        ida.centavos -= centavos;
        lote.restante -= centavos;
        gastos.push({ lote: lote.id, salida: ida.salida, centavos });
      }
      continue;
    }
    const pendiente = { salida: m, centavos: -m.centavos };
    const propio = m.clase === "propio" && m.ingresoId !== null ? porId.get(m.ingresoId) : undefined;
    if (propio) {
      const centavos = Math.min(pendiente.centavos, propio.restante);
      propio.restante -= centavos;
      pendiente.centavos -= centavos;
      if (centavos > 0) gastos.push({ lote: propio.id, salida: m, centavos });
    }
    salidas.push(pendiente);
    if (m.clase === "mover" && m.sobreId !== null)
      sinVolver.set(m.sobreId, [...(sinVolver.get(m.sobreId) ?? []), pendiente]);
  }
  // Lo que las vueltas pagaron ya no sale de ningún lote: queda lo que no volvió.
  let i = 0;
  for (const s of salidas) {
    let resta = s.centavos;
    while (resta > 0 && i < lotes.length) {
      const centavos = Math.min(resta, lotes[i].restante);
      if (centavos > 0) {
        lotes[i].restante -= centavos;
        gastos.push({ lote: lotes[i].id, salida: s.salida, centavos });
        resta -= centavos;
      }
      if (lotes[i].restante === 0) i++;
    }
  }
  return {
    restante: (id: number) => porId.get(id)?.restante ?? 0,
    existe: (id: number) => porId.has(id),
    gastos,
  };
}

/**
 * El plan de quitar el lote `loteId` con todo lo que se hizo con él: retira lo repartido y lo movido; si algo se prestó
 * o lo usa el reparto de otro ingreso, no se puede.
 */
export function planDeRetiro(movimientos: MovimientoDePorAsignar[], loteId: number): PlanDeRetiro {
  const delLote = cuentaDeLotes(movimientos).gastos.filter((g) => g.lote === loteId);
  const retiros: Retiro[] = [];
  const salidas = new Map<Salida["clase"], Salida>();
  for (const g of delLote) {
    const { clase, id, sobreId, nombre, centavos: total, ingresoId } = g.salida;
    // El reparto propio del lote se va con él.
    if (clase === "propio" && ingresoId === loteId) continue;
    if ((clase === "reparto" || clase === "mover") && sobreId !== null) {
      retiros.push({
        id,
        sobreId,
        nombre: nombre ?? "?",
        centavos: g.centavos,
        borra: g.centavos === -total,
      });
      continue;
    }
    const tipo = clase === "prestamo" || clase === "propio" ? clase : "otra";
    salidas.set(tipo, {
      clase: tipo,
      centavos: (salidas.get(tipo)?.centavos ?? 0) + g.centavos,
    });
  }
  return salidas.size > 0 ? { alcanza: false, salidas: [...salidas.values()] } : { alcanza: true, retiros };
}

/** Por qué no se puede: parte de este dinero salió de una forma que no se retira. */
export function noAlcanzaElRetiro(plan: { salidas: Salida[] }) {
  const partes = plan.salidas.map((s) =>
    s.clase === "prestamo"
      ? `${formatearCifra(s.centavos)} se prestaron`
      : s.clase === "propio"
        ? `${formatearCifra(s.centavos)} los usa el reparto de un ingreso que bajaste`
        : `${formatearCifra(s.centavos)} salieron de otra forma`,
  );
  return `De este dinero, ${partes.join(" y ")}. Eso no se puede retirar, así que no se deshace.`;
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
