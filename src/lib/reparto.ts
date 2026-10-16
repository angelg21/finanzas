/**
 * Propuesta de reparto de un ingreso entre los sobres (spec 004, criterios 1 a 5). Primero las reglas fijas, por
 * orden, con lo que les falta este mes; luego los porcentajes sobre lo que queda, en proporción a sus puntos base y
 * cuadrados por mayor residuo. Ningún sobre pasa de su tope: lo que no toma se reparte entre los demás porcentajes.
 * Todo con enteros; las proporciones van en BigInt para que un monto enorme no pierda centavos.
 */

export type TipoRegla = "fijo" | "porcentaje";

/** Una regla activa con lo que hace falta saber de su sobre. */
export type ReglaParaRepartir = {
  sobreId: number;
  orden: number;
  tipo: TipoRegla;
  /** fijo: centavos al mes. porcentaje: puntos base, 10000 = 100 %. */
  valor: number;
  /** Emergencia, o una meta con monto objetivo: el sobre deja de recibir al llegar aquí. */
  topeCentavos: number | null;
};

export type EntradaReparto = {
  /** Lo que se reparte, en centavos de USD. */
  monto: number;
  reglas: ReglaParaRepartir[];
  /** Por sobre: lo que ya recibió desde "Por asignar" en el mes de la fecha del ingreso. */
  recibidoEnElMes: Record<number, number>;
  /** Por sobre: su saldo en USD, para los topes. */
  saldos: Record<number, number>;
};

export type Asignacion = { sobreId: number; centavos: number };

/** Una asignación por regla, en el orden en que llegaron; lo que no tiene destino queda sin asignar. */
export type Propuesta = { asignaciones: Asignacion[]; sinAsignar: number };

/** 100 % en puntos base. */
export const PUNTOS_BASE_TOTAL = 10_000;

const cero = BigInt(0);
const uno = BigInt(1);

function exigirEntero(valor: number, que: string) {
  if (!Number.isSafeInteger(valor)) throw new RangeError(`${que} debe ser un entero: ${valor}`);
}

function validar({ monto, reglas, recibidoEnElMes, saldos }: EntradaReparto) {
  exigirEntero(monto, "El monto");
  if (monto < 0) throw new RangeError(`El monto no puede ser negativo: ${monto}`);
  const sobres = new Set<number>();
  for (const r of reglas) {
    exigirEntero(r.sobreId, "El sobre");
    exigirEntero(r.orden, "El orden");
    exigirEntero(r.valor, "El valor de la regla");
    if (r.tipo !== "fijo" && r.tipo !== "porcentaje") throw new RangeError(`Tipo de regla desconocido: ${r.tipo}`);
    if (r.valor <= 0) throw new RangeError(`El valor de la regla debe ser positivo: ${r.valor}`);
    if (r.tipo === "porcentaje" && r.valor > PUNTOS_BASE_TOTAL)
      throw new RangeError(`Porcentaje mayor que 100 %: ${r.valor}`);
    if (r.topeCentavos !== null) exigirEntero(r.topeCentavos, "El tope");
    if (sobres.has(r.sobreId)) throw new RangeError(`Dos reglas para el sobre ${r.sobreId}`);
    sobres.add(r.sobreId);
  }
  for (const v of Object.values(recibidoEnElMes)) exigirEntero(v, "Lo recibido en el mes");
  for (const v of Object.values(saldos)) exigirEntero(v, "El saldo");
}

const porOrden = (a: ReglaParaRepartir, b: ReglaParaRepartir) => a.orden - b.orden || a.sobreId - b.sobreId;

/** Lo que le falta a un sobre para su tope, y 0 si ya llegó; null si no tiene tope. */
function faltaParaTope(r: ReglaParaRepartir, saldos: Record<number, number>): number | null {
  return r.topeCentavos === null ? null : Math.max(0, r.topeCentavos - (saldos[r.sobreId] ?? 0));
}

/**
 * La bolsa entre los porcentajes. Cada vuelta fija en su tope a los que lo alcanzarían con su parte y saca lo que
 * toman de la bolsa; los demás reciben más, así que se repite hasta que nadie pase de su tope. Lo que queda se
 * reparte por mayor residuo, con el orden en los empates. Si todos llegaron a su tope, sobra.
 */
function repartirPorcentajes(monto: number, reglas: ReglaParaRepartir[], saldos: Record<number, number>) {
  const centavos = new Map<number, number>();
  let abiertas = [...reglas].sort(porOrden);
  let bolsa = BigInt(monto);
  const totalDe = (rs: ReglaParaRepartir[]) => rs.reduce((a, r) => a + BigInt(r.valor), cero);

  while (abiertas.length > 0) {
    const total = totalDe(abiertas);
    const llenas = abiertas.filter((r) => {
      const falta = faltaParaTope(r, saldos);
      return falta !== null && bolsa * BigInt(r.valor) >= BigInt(falta) * total;
    });
    if (llenas.length === 0) break;
    for (const r of llenas) {
      const falta = faltaParaTope(r, saldos) ?? 0;
      centavos.set(r.sobreId, falta);
      bolsa -= BigInt(falta);
    }
    abiertas = abiertas.filter((r) => !llenas.includes(r));
  }
  if (abiertas.length === 0) return { centavos, sobra: Number(bolsa) };

  const total = totalDe(abiertas);
  const partes = abiertas.map((r, posicion) => {
    const producto = bolsa * BigInt(r.valor);
    return { sobreId: r.sobreId, posicion, base: producto / total, resto: producto % total };
  });
  let faltan = partes.reduce((a, p) => a - p.base, bolsa);
  const porResto = [...partes].sort((a, b) =>
    a.resto === b.resto ? a.posicion - b.posicion : a.resto > b.resto ? -1 : 1,
  );
  for (const p of porResto) {
    if (faltan === cero) break;
    p.base += uno;
    faltan -= uno;
  }
  for (const p of partes) centavos.set(p.sobreId, Number(p.base));
  return { centavos, sobra: 0 };
}

export function proponerReparto(entrada: EntradaReparto): Propuesta {
  validar(entrada);
  const { monto, reglas, recibidoEnElMes, saldos } = entrada;

  // Los fijos van antes que los porcentajes sin importar su orden, y piden lo que les falta este mes.
  const centavos = new Map<number, number>();
  let restante = monto;
  for (const r of reglas.filter((x) => x.tipo === "fijo").sort(porOrden)) {
    const pendiente = Math.max(0, r.valor - (recibidoEnElMes[r.sobreId] ?? 0));
    const falta = faltaParaTope(r, saldos) ?? pendiente;
    const toma = Math.min(restante, pendiente, falta);
    centavos.set(r.sobreId, toma);
    restante -= toma;
  }

  const porcentajes = repartirPorcentajes(
    restante,
    reglas.filter((x) => x.tipo === "porcentaje"),
    saldos,
  );
  for (const [sobreId, c] of porcentajes.centavos) centavos.set(sobreId, c);

  const asignaciones = reglas.map((r) => ({ sobreId: r.sobreId, centavos: centavos.get(r.sobreId) ?? 0 }));
  const sinAsignar = monto - asignaciones.reduce((a, x) => a + x.centavos, 0);
  return { asignaciones, sinAsignar };
}
