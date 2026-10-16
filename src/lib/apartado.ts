/**
 * Apartar lo que ya se tiene para pagar deudas (spec 005, criterio 13): una reasignación de un sobre a Deudas. Nunca
 * desde Deudas, ni desde Inversión, que nunca se retira (plan, sección 2). "Por asignar" sí. Es pura: la base vuelve a
 * comprobar el saldo del origen con el candado del reparto antes de escribir.
 */
import { aCentavos, formatearCifra } from "./dinero";

export type SobreParaApartar = { id: number; nombre: string; tipo: string; saldoCentavos: number };

export function puedeApartarDesde(tipo: string): boolean {
  return tipo !== "deudas" && tipo !== "inversion";
}

/** Los orígenes que se ofrecen: los que pueden apartar y tienen saldo, en el orden en que llegan. */
export function sobresParaApartar<S extends SobreParaApartar>(sobres: S[]): S[] {
  return sobres.filter((s) => puedeApartarDesde(s.tipo) && s.saldoCentavos > 0);
}

/** Una reasignación lista para insertar, con la forma que exige el check por tipo. */
export type FilaApartado = {
  fecha: string;
  tipo: "reasignacion";
  montoCentavos: number;
  moneda: "USD";
  montoUsdCentavos: number;
  montoDestinoCentavos: null;
  monedaDestino: null;
  tasa: null;
  cuentaOrigenId: null;
  cuentaDestinoId: null;
  sobreOrigenId: number;
  sobreDestinoId: number;
  categoriaId: null;
  deudaId: null;
  nota: null;
  origen: "manual";
};

export type ErroresApartado = Partial<Record<"sobre" | "monto", string>>;
export type ApartadoPreparado = { ok: true; fila: FilaApartado } | { ok: false; errores: ErroresApartado };

function leerMonto(texto: string, origen: SobreParaApartar | undefined): number | string {
  if (texto.trim() === "") return "Escribe el monto";
  try {
    const centavos = aCentavos(texto);
    if (origen && centavos > origen.saldoCentavos)
      return `No puede pasar de lo que tiene ${origen.nombre}: ${formatearCifra(origen.saldoCentavos)}`;
    if (centavos >= 1) return centavos;
  } catch {
    // aCentavos lanza con un mensaje técnico; al usuario se le muestra el del campo.
  }
  return "Escribe un monto mayor que cero";
}

/** De 0,01 al saldo del origen, que tiene que estar entre los que se ofrecen. Con la fecha de hoy y sin nota. */
export function prepararApartado(
  e: { monto: string; sobreOrigenId: number | null },
  sobres: SobreParaApartar[],
  sobreDeudasId: number,
  hoy: string,
): ApartadoPreparado {
  const origen = sobresParaApartar(sobres).find((s) => s.id === e.sobreOrigenId && s.id !== sobreDeudasId);
  const errores: ErroresApartado = {};
  if (!origen) errores.sobre = "Elige de dónde apartar";
  const monto = leerMonto(e.monto, origen);
  if (typeof monto === "string") errores.monto = monto;
  if (!origen || typeof monto === "string") return { ok: false, errores };
  return {
    ok: true,
    fila: {
      fecha: hoy,
      tipo: "reasignacion",
      montoCentavos: monto,
      moneda: "USD",
      montoUsdCentavos: monto,
      montoDestinoCentavos: null,
      monedaDestino: null,
      tasa: null,
      cuentaOrigenId: null,
      cuentaDestinoId: null,
      sobreOrigenId: origen.id,
      sobreDestinoId: sobreDeudasId,
      categoriaId: null,
      deudaId: null,
      nota: null,
      origen: "manual",
    },
  };
}
