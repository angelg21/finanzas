/**
 * Cuánto de lleno está un sobre, para su icono: el sobre se llena desde abajo según su saldo. Se mide contra su tope
 * (Emergencia, una meta con monto), contra lo que pide su desglose del año (un fondo como Ocasiones) o contra su fijo
 * del mes (Gastos del mes, Familia), que se vacía a medida que se gasta. Deudas se mide contra lo que se debe. Sin nada contra qué medirlo, no hay
 * porcentaje y el icono se pinta lleno de su color. Todo con enteros.
 */

export type MedidaDeSobre = {
  saldoCentavos: number;
  topeCentavos: number | null;
  /** Fondos: la suma anual de su desglose. */
  anualCentavos: number | null;
  /** El valor de su regla fija activa, si tiene. */
  fijoMensualCentavos: number | null;
  /** Deudas: el pendiente de las deudas abiertas que debo, con fecha o sin ella (spec 005). */
  debidoCentavos?: number | null;
};

/**
 * `porcentaje`: de 0 a 100, entero y redondeado hacia abajo, o null sin medida. `alcanzado`: llegó a su tope o a lo
 * que pide el año; un fijo mensual no se "alcanza". `negativo`: el saldo está por debajo de cero.
 */
export type NivelDeSobre = { porcentaje: number | null; alcanzado: boolean; negativo: boolean };

function exigirEntero(valor: number | null, que: string) {
  if (valor !== null && !Number.isSafeInteger(valor)) throw new RangeError(`${que} debe ser un entero: ${valor}`);
}

/** Lo que lleva sobre la medida, en enteros de 0 a 100, sin pasar por coma flotante. */
function porcentajeDe(saldo: number, medida: number) {
  const centesimas = (BigInt(saldo) * BigInt(100)) / BigInt(medida);
  return Number(centesimas > BigInt(100) ? BigInt(100) : centesimas);
}

export function nivelDeSobre({
  saldoCentavos,
  topeCentavos,
  anualCentavos,
  fijoMensualCentavos,
  debidoCentavos = null,
}: MedidaDeSobre): NivelDeSobre {
  exigirEntero(saldoCentavos, "El saldo");
  exigirEntero(topeCentavos, "El tope");
  exigirEntero(anualCentavos, "Lo del año");
  exigirEntero(fijoMensualCentavos, "El fijo mensual");
  exigirEntero(debidoCentavos, "Lo que se debe");
  if (saldoCentavos < 0) return { porcentaje: 0, alcanzado: false, negativo: true };

  const positiva = (m: number | null) => (m !== null && m > 0 ? m : null);
  const meta = positiva(topeCentavos) ?? positiva(anualCentavos) ?? positiva(debidoCentavos);
  if (meta !== null) {
    return { porcentaje: porcentajeDe(saldoCentavos, meta), alcanzado: saldoCentavos >= meta, negativo: false };
  }
  const fijo = positiva(fijoMensualCentavos);
  if (fijo !== null) return { porcentaje: porcentajeDe(saldoCentavos, fijo), alcanzado: false, negativo: false };
  return { porcentaje: null, alcanzado: false, negativo: false };
}

/**
 * Para pintar el icono: como nivelDeSobre, pero una medida que no es un entero seguro (un dato que solo entra por SQL)
 * da un icono sin medida en vez de lanzar. Así no tumba el ingreso ni el reparto, que lo leen, ni deja el monto en
 * un error de los registros.
 */
export function nivelParaIcono(medida: MedidaDeSobre): NivelDeSobre {
  const enteros = Object.values(medida).every((v) => v === null || v === undefined || Number.isSafeInteger(v));
  return enteros ? nivelDeSobre(medida) : { porcentaje: null, alcanzado: false, negativo: false };
}

/** El tono del anillo de Sobres por tipo: 1 pino profundo, 2 verde, 3 blanco, 4 salvia gris, 5 rayado, 6 puntos. */
export type PasoDeSobre = 1 | 2 | 3 | 4 | 5 | 6;

const pasos: Record<string, PasoDeSobre> = { emergencia: 1, inversion: 2, meta: 3, gastos: 4, familia: 5, fondo: 6 };

/** El color sigue al tipo de sobre, no a su tamaño; un tipo sin tono propio lleva el de las metas. */
export function pasoDeSobre(tipo: string): PasoDeSobre {
  return pasos[tipo] ?? 3;
}
