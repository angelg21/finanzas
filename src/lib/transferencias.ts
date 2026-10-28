/**
 * Transferir entre cuentas (spec 011): pasar dinero de una cuenta en dólares a otra, con lo que salió y lo que llegó.
 * Lo que llegó es la transferencia: una cuenta baja y la otra sube, y los sobres no cambian (plan, sección 4). La
 * diferencia es la comisión: un gasto desde la cuenta de origen, del sobre que se elija, en "Comisiones". Así la
 * cuenta de origen baja todo lo que salió, la de destino sube lo que llegó, y el cuadre se mantiene: las cuentas y los
 * sobres bajan lo mismo, la comisión. USD, USDT y USDC valen 1 a 1; los bolívares no entran (eso es la venta de USDT
 * del gasto en bolívares). Es pura: la base busca o crea la categoría y escribe las dos filas juntas.
 */
import { type Moneda, aCentavos } from "./dinero";
import { fechaDesdeAtajo, fechaValida } from "./fechas";
import { sobreAceptaGasto } from "./gastos";

export type CuentaParaTransferir = { id: number; nombre: string; moneda: Moneda };
export type SobreParaComision = { id: number; nombre: string; tipo: string };

/** Lo que llega del formulario, con los montos como texto. */
export type EntradaTransferencia = {
  origenId: number | null;
  destinoId: number | null;
  salio: string;
  /** "" si llegó lo mismo que salió: sin comisión. */
  llego: string;
  /** El sobre que paga la comisión; solo hace falta si la hay. */
  sobreId: number | null;
  /** "hoy", "ayer" o el día, como en la captura de gasto. */
  fecha: string;
  nota: string;
};

export type ErroresTransferencia = Partial<
  Record<"origen" | "destino" | "salio" | "llego" | "sobre" | "fecha", string>
>;

/** La transferencia lista para insertar, con la forma que exige el check por tipo. */
export type FilaTransferencia = {
  fecha: string;
  tipo: "transferencia";
  montoCentavos: number;
  moneda: Moneda;
  montoUsdCentavos: number;
  /** Solo si cambia de moneda (USD a USDT, por ejemplo): lo que recibe la cuenta destino, 1 a 1. */
  montoDestinoCentavos: number | null;
  monedaDestino: Moneda | null;
  tasa: null;
  cuentaOrigenId: number;
  cuentaDestinoId: number;
  sobreOrigenId: null;
  sobreDestinoId: null;
  categoriaId: null;
  deudaId: null;
  nota: string | null;
  origen: "manual";
};

/** La comisión: un gasto desde la cuenta de origen. La categoría la pone la base ("Comisiones"). */
export type FilaComision = {
  fecha: string;
  tipo: "gasto";
  montoCentavos: number;
  moneda: Moneda;
  montoUsdCentavos: number;
  montoDestinoCentavos: null;
  monedaDestino: null;
  tasa: null;
  cuentaOrigenId: number;
  cuentaDestinoId: null;
  sobreOrigenId: number;
  sobreDestinoId: null;
  deudaId: null;
  nota: string | null;
  origen: "manual";
};

export type TransferenciaPreparada =
  | { ok: true; transferencia: FilaTransferencia; comision: FilaComision | null }
  | { ok: false; errores: ErroresTransferencia };

/** El nombre de la categoría de gasto de las comisiones: se crea la primera vez que hace falta. */
export const categoriaDeComisiones = "Comisiones";

function leerMonto(texto: string): number | string {
  if (texto.trim() === "") return "Escribe el monto";
  try {
    const centavos = aCentavos(texto);
    if (centavos >= 1) return centavos;
  } catch {
    // aCentavos lanza con un mensaje técnico; al usuario se le muestra el del campo.
  }
  return "Escribe un monto mayor que cero";
}

export function prepararTransferencia(
  e: EntradaTransferencia,
  cuentas: CuentaParaTransferir[],
  sobres: SobreParaComision[],
  hoy: string,
): TransferenciaPreparada {
  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const origen = enDolares.find((c) => c.id === e.origenId);
  const destino = enDolares.find((c) => c.id === e.destinoId);
  const errores: ErroresTransferencia = {};
  if (!origen) errores.origen = "Elige de qué cuenta salió";
  if (!destino) errores.destino = "Elige a qué cuenta llegó";
  else if (origen && destino.id === origen.id) errores.destino = "Elige otra cuenta";

  const salio = leerMonto(e.salio);
  if (typeof salio === "string") errores.salio = salio;
  const llego = e.llego.trim() === "" ? salio : leerMonto(e.llego);
  if (typeof llego === "string") errores.llego = llego;
  else if (typeof salio === "number" && llego > salio) errores.llego = "No puede pasar de lo que salió";

  const comision = typeof salio === "number" && typeof llego === "number" ? salio - llego : 0;
  const sobre = sobres.find((s) => s.id === e.sobreId && sobreAceptaGasto(s.tipo));
  if (comision > 0 && !sobre) errores.sobre = "Elige de qué sobre sale la comisión";

  const fecha = fechaDesdeAtajo(e.fecha, hoy);
  if (!fechaValida(fecha, hoy)) errores.fecha = "Elige hoy o un día anterior";

  if (
    !origen ||
    !destino ||
    typeof salio === "string" ||
    typeof llego === "string" ||
    Object.keys(errores).length > 0
  ) {
    return { ok: false, errores };
  }
  const nota = e.nota.trim() || null;
  const cambiaDeMoneda = origen.moneda !== destino.moneda;
  return {
    ok: true,
    transferencia: {
      fecha,
      tipo: "transferencia",
      montoCentavos: llego,
      moneda: origen.moneda,
      montoUsdCentavos: llego,
      montoDestinoCentavos: cambiaDeMoneda ? llego : null,
      monedaDestino: cambiaDeMoneda ? destino.moneda : null,
      tasa: null,
      cuentaOrigenId: origen.id,
      cuentaDestinoId: destino.id,
      sobreOrigenId: null,
      sobreDestinoId: null,
      categoriaId: null,
      deudaId: null,
      nota,
      origen: "manual",
    },
    comision:
      comision > 0 && sobre
        ? {
            fecha,
            tipo: "gasto",
            montoCentavos: comision,
            moneda: origen.moneda,
            montoUsdCentavos: comision,
            montoDestinoCentavos: null,
            monedaDestino: null,
            tasa: null,
            cuentaOrigenId: origen.id,
            cuentaDestinoId: null,
            sobreOrigenId: sobre.id,
            sobreDestinoId: null,
            deudaId: null,
            nota: `Comisión de la transferencia a ${destino.nombre}`,
            origen: "manual",
          }
        : null,
  };
}
