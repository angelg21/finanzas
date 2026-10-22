/**
 * Gastos por completar (spec 009). Un pendiente no es un movimiento: se anota con lo que se sabe (categoría,
 * descripción, fecha y, si se sabe, el monto) y no mueve dinero (criterio 1). Completarlo lo vuelve un gasto con las
 * mismas reglas de la captura. Completar varios a la vez, pagados vendiendo USDT, registra una sola venta por lo
 * vendido y un gasto en Bs por pendiente a la misma tasa; si de la venta sobran bolívares, se pregunta: a la cuenta de
 * Bolívares, o un gasto más, para que Binance baje exactamente lo vendido (criterio 8). Es pura: reutiliza
 * prepararGasto, así que la tasa, el redondeo y los mensajes son los de la captura.
 */
import { aCentavos, centavosATexto } from "./dinero";
import { fechaValida } from "./fechas";
import { type CuentaGasto, type FilaMovimiento, type FormaPago, prepararGasto } from "./gastos";

export type MonedaPendiente = "VES" | "USD";

export type FilaPorCompletar = {
  fecha: string;
  categoriaId: number;
  nota: string | null;
  montoCentavos: number | null;
  moneda: MonedaPendiente | null;
};

export type ErroresPorCompletar = Partial<Record<"categoria" | "fecha" | "monto" | "moneda", string>>;

/** Un pendiente al anotarlo (criterio 2): categoría de las válidas, fecha de hoy o antes, y monto opcional con moneda. */
export function validarPorCompletar(
  e: { categoriaId: number | null; nota: string; fecha: string; monto: string; moneda: string },
  categoriasValidas: number[],
  hoy: string,
): { ok: true; fila: FilaPorCompletar } | { ok: false; errores: ErroresPorCompletar } {
  const errores: ErroresPorCompletar = {};
  if (e.categoriaId === null || !categoriasValidas.includes(e.categoriaId)) errores.categoria = "Elige una categoría";
  if (!fechaValida(e.fecha, hoy)) errores.fecha = "Elige hoy o un día anterior";
  let monto: number | null = null;
  if (e.monto.trim() !== "") {
    try {
      const centavos = aCentavos(e.monto);
      if (centavos >= 1 && Number.isSafeInteger(centavos)) monto = centavos;
    } catch {
      // aCentavos lanza con un mensaje técnico; al usuario se le muestra el del campo.
    }
    if (monto === null) errores.monto = "Escribe un monto mayor que cero, o déjalo vacío";
    else if (e.moneda !== "VES" && e.moneda !== "USD") errores.moneda = "Elige si son Bs o USD";
  }
  if (Object.keys(errores).length > 0 || e.categoriaId === null) return { ok: false, errores };
  return {
    ok: true,
    fila: {
      fecha: e.fecha,
      categoriaId: e.categoriaId,
      nota: e.nota.trim() || null,
      montoCentavos: monto,
      moneda: monto === null ? null : (e.moneda as MonedaPendiente),
    },
  };
}

export type ItemVarios = {
  pendienteId: number;
  monto: string;
  sobreId: number;
  categoriaId: number;
  fecha: string;
  nota: string;
};

export type EntradaVarios = {
  forma: FormaPago;
  /** En dólares, la cuenta del gasto; vendiendo, la cuenta de donde salen los dólares. */
  cuentaOrigen: CuentaGasto;
  cuentaBolivares: CuentaGasto | null;
  tasa: string;
  /** Lo vendido en la venta única; solo vendiendo. */
  vendido: string;
  items: ItemVarios[];
  /** Qué hacer con lo que sobre de la venta: "" sin decidir todavía. */
  resto: "" | "bolivares" | "gasto";
  restoCategoriaId: number | null;
  restoSobreId: number | null;
};

export type ErroresVarios = Partial<Record<"general" | "tasa" | "vendido" | "cuenta" | "resto", string>> & {
  porPendiente?: Record<number, string>;
};

export type VariosPreparado =
  | { estado: "ok"; filas: FilaMovimiento[]; pendientes: number[] }
  /** Sobran bolívares de la venta y no se dijo qué hacer con ellos: la pantalla pregunta. */
  | { estado: "resto"; restoBs: number }
  | { estado: "error"; errores: ErroresVarios };

export function prepararCompletarVarios(e: EntradaVarios, hoy: string): VariosPreparado {
  if (e.items.length === 0) return { estado: "error", errores: { general: "Elige al menos un gasto" } };
  const errores: ErroresVarios = {};
  const porPendiente: Record<number, string> = {};
  const anotar = (p: { tasa?: string; cuenta?: string; vendido?: string }) => {
    if (p.tasa) errores.tasa = p.tasa;
    if (p.cuenta) errores.cuenta = p.cuenta;
    if (p.vendido) errores.vendido = p.vendido;
  };

  // Cada pendiente, como un gasto en dólares o en Bs del saldo; vendiendo, la venta va aparte.
  const gastos: FilaMovimiento[] = [];
  for (const item of e.items) {
    const p = prepararGasto(
      {
        forma: e.forma === "dolares" ? "dolares" : "saldo",
        monto: item.monto,
        tasa: e.tasa,
        vendido: "",
        cuentaOrigen: e.cuentaOrigen,
        cuentaBolivares: e.cuentaBolivares,
        sobreId: item.sobreId,
        categoriaId: item.categoriaId,
        fecha: item.fecha,
        nota: item.nota,
      },
      hoy,
    );
    if (p.ok) gastos.push(...p.filas);
    else {
      anotar(p.errores);
      const propio = p.errores.monto ?? p.errores.fecha;
      if (propio) porPendiente[item.pendienteId] = propio;
    }
  }

  let venta: FilaMovimiento | null = null;
  const totalBs = gastos.reduce((a, g) => a + g.montoCentavos, 0);
  if (e.forma === "vendiendo") {
    // La venta única, preparada como la de la captura por el total: valida lo vendido, la tasa y la cuenta.
    const p = prepararGasto(
      {
        forma: "vendiendo",
        monto: centavosATexto(Math.max(totalBs, 1)),
        tasa: e.tasa,
        vendido: e.vendido,
        cuentaOrigen: e.cuentaOrigen,
        cuentaBolivares: e.cuentaBolivares,
        sobreId: e.items[0].sobreId,
        categoriaId: e.items[0].categoriaId,
        fecha: hoy,
        nota: "",
      },
      hoy,
    );
    if (p.ok) venta = p.filas.find((f) => f.tipo === "transferencia") ?? null;
    else anotar(p.errores);
  }

  if (Object.keys(porPendiente).length > 0) errores.porPendiente = porPendiente;
  if (Object.keys(errores).length > 0) return { estado: "error", errores };
  if (e.forma !== "vendiendo" || !venta) {
    return { estado: "ok", filas: gastos, pendientes: e.items.map((i) => i.pendienteId) };
  }

  const resto = (venta.montoDestinoCentavos ?? 0) - totalBs;
  const filas = [venta, ...gastos];
  if (resto > 0) {
    if (e.resto === "") return { estado: "resto", restoBs: resto };
    if (e.resto === "gasto") {
      if (e.restoCategoriaId === null || e.restoSobreId === null) {
        return { estado: "error", errores: { resto: "Elige la categoría y el sobre del resto" } };
      }
      const p = prepararGasto(
        {
          forma: "saldo",
          monto: centavosATexto(resto),
          tasa: e.tasa,
          vendido: "",
          cuentaOrigen: e.cuentaOrigen,
          cuentaBolivares: e.cuentaBolivares,
          sobreId: e.restoSobreId,
          categoriaId: e.restoCategoriaId,
          fecha: hoy,
          nota: "Resto de la venta",
        },
        hoy,
      );
      if (!p.ok) return { estado: "error", errores: { resto: "No se pudo preparar el resto" } };
      filas.push(...p.filas);
    }
  }
  return { estado: "ok", filas, pendientes: e.items.map((i) => i.pendienteId) };
}
