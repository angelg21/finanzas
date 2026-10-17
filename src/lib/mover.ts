/**
 * Mover dinero entre sobres (spec 007, criterios 7 y 8): una reasignación de hoy, de 0,01 al saldo del origen, para
 * que nunca quede en negativo. Inversión nunca se retira (plan, sección 2): sacar de ahí pide una confirmación. Es
 * pura: la base vuelve a mirar el saldo del origen con el candado del reparto antes de escribir.
 */
import { aCentavos, formatearCifra } from "./dinero";

export type SobreParaMover = { id: number; nombre: string; tipo: string; saldoCentavos: number };

export type ErroresMover = Partial<Record<"origen" | "destino" | "monto", string>>;

/** Una reasignación lista para insertar, con la forma que exige el check por tipo. */
export type FilaMover = {
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
  nota: string | null;
  origen: "manual";
};

export type MoverPreparado =
  { estado: "ok"; fila: FilaMover } | { estado: "confirmar" } | { estado: "error"; errores: ErroresMover };

function leerMonto(texto: string, origen: SobreParaMover | undefined): number | string {
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

export function prepararMover(
  e: { monto: string; origenId: number | null; destinoId: number | null; nota: string; confirmaInversion: boolean },
  sobres: SobreParaMover[],
  hoy: string,
): MoverPreparado {
  const origen = sobres.find((s) => s.id === e.origenId);
  const destino = sobres.find((s) => s.id === e.destinoId);
  const errores: ErroresMover = {};
  if (!origen) errores.origen = "Elige de dónde mover";
  if (!destino) errores.destino = "Elige a dónde mover";
  else if (origen && destino.id === origen.id) errores.destino = "Elige otro sobre";
  const monto = leerMonto(e.monto, origen);
  if (typeof monto === "string") errores.monto = monto;
  if (!origen || !destino || typeof monto === "string" || Object.keys(errores).length > 0) {
    return { estado: "error", errores };
  }
  if (origen.tipo === "inversion" && !e.confirmaInversion) return { estado: "confirmar" };
  return {
    estado: "ok",
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
      sobreDestinoId: destino.id,
      categoriaId: null,
      deudaId: null,
      nota: e.nota.trim() || null,
      origen: "manual",
    },
  };
}
