/**
 * Reparto de un total entre categorías para el anillo de movimientos (spec 003, criterios 1 y 2): de mayor a menor,
 * con el total exacto en centavos y porcentajes enteros que suman 100 por el método del mayor residuo. Todo con
 * enteros: el residuo de cada uno es `(centavos × 100) mod total`, sin divisiones con decimales.
 */

export type Porcion<T> = T & { porcentaje: number; menosDeUno: boolean };

function exigirCentavos(centavos: number) {
  if (!Number.isSafeInteger(centavos) || centavos < 0 || !Number.isSafeInteger(centavos * 100)) {
    throw new Error(`Monto fuera de rango para repartir: ${centavos}`);
  }
}

export function distribuirPorCategoria<T extends { centavos: number }>(
  totales: T[],
): { total: number; porciones: Porcion<T>[] } {
  totales.forEach((t) => exigirCentavos(t.centavos));
  const conMonto = totales.filter((t) => t.centavos > 0).sort((a, b) => b.centavos - a.centavos);
  const total = conMonto.reduce((a, t) => a + t.centavos, 0);
  exigirCentavos(total);
  if (total === 0) return { total: 0, porciones: [] };

  const partes = conMonto.map((t, orden) => {
    const resto = (t.centavos * 100) % total;
    return { t, orden, base: (t.centavos * 100 - resto) / total, resto };
  });
  // Los puntos que faltan para 100 van a los residuos mayores; a igual residuo, al monto mayor.
  let faltan = 100 - partes.reduce((a, p) => a + p.base, 0);
  const extra = new Set<number>();
  for (const p of [...partes].sort((a, b) => b.resto - a.resto || a.orden - b.orden)) {
    if (faltan === 0) break;
    extra.add(p.orden);
    faltan--;
  }

  const porciones = partes.map(({ t, orden, base }) => {
    const porcentaje = base + (extra.has(orden) ? 1 : 0);
    return { ...t, porcentaje, menosDeUno: porcentaje === 0 };
  });
  return { total, porciones };
}
