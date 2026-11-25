import { type SQL, type SQLWrapper, inArray, sql } from "drizzle-orm";
// Import relativo, como movimientos.ts: lo cargan también los scripts de la base.
import { prefijoDeHistorial } from "../lib/importacion";
import { type Efecto, tiposCon } from "../lib/saldos";
import { movimientos } from "./schema";

/*
  Cuánto suma o resta cada movimiento al saldo de un sobre o de una cuenta, para sum(...) en las consultas de saldos
  (spec 005, criterio 9). Qué tipos mueven cada lado no se repite aquí: sale de efectoDe en src/lib/saldos.ts, la
  misma regla que saldosTras. Un tipo nuevo entra en todas las sumas a la vez. Lo importado de la app vieja es historial
  (spec 012): sale en Movimientos y en las gráficas, pero no mueve ningún saldo, y así el cuadre no cambia.
*/

const tipoQue = (lado: keyof Efecto) => inArray(movimientos.tipo, tiposCon(lado));
/** Una fila del historial de la app vieja (spec 012): importada y con su referencia "historial-". */
export const esHistorial = sql`(${movimientos.origen}::text = 'importado'
  and coalesce(${movimientos.referenciaExterna}, '') like ${`${prefijoDeHistorial}%`})`;

/**
 * Lo que cuenta como gasto en totales, gráficas, la pestaña Gastos y el importador: los gastos, y los pagos de deuda a
 * los que se les puso categoría (spec 014). Un pago sin categoría no es gasto y va a Mover (spec 005, criterio 18). No
 * cambia ningún saldo: un pago ya sale de su cuenta y su sobre.
 */
export const cuentaComoGasto = sql`(${movimientos.tipo} = 'gasto'
  or (${movimientos.tipo} = 'pago_deuda' and ${movimientos.categoriaId} is not null))`;

/** En USD, para el saldo del sobre `sobreId` (una columna o un id). */
export function efectoEnSobre(sobreId: SQLWrapper | number): SQL {
  return sql`case
    when ${esHistorial} then 0
    when ${tipoQue("entraASobre")} and ${movimientos.sobreDestinoId} = ${sobreId} then ${movimientos.montoUsdCentavos}
    when ${tipoQue("saleDeSobre")} and ${movimientos.sobreOrigenId} = ${sobreId} then -${movimientos.montoUsdCentavos}
    else 0 end`;
}

/** En la moneda de la cuenta: entra lo recibido en su moneda, o el monto si no se indica. */
export function efectoEnCuenta(cuentaId: SQLWrapper | number): SQL {
  return sql`case
    when ${esHistorial} then 0
    when ${tipoQue("entraACuenta")} and ${movimientos.cuentaDestinoId} = ${cuentaId}
      then coalesce(${movimientos.montoDestinoCentavos}, ${movimientos.montoCentavos})
    when ${tipoQue("saleDeCuenta")} and ${movimientos.cuentaOrigenId} = ${cuentaId} then -${movimientos.montoCentavos}
    else 0 end`;
}

/** En USD, para el total y la verificación de /cuentas. */
export function efectoEnCuentaUsd(cuentaId: SQLWrapper | number): SQL {
  return sql`case
    when ${esHistorial} then 0
    when ${tipoQue("entraACuenta")} and ${movimientos.cuentaDestinoId} = ${cuentaId} then ${movimientos.montoUsdCentavos}
    when ${tipoQue("saleDeCuenta")} and ${movimientos.cuentaOrigenId} = ${cuentaId} then -${movimientos.montoUsdCentavos}
    else 0 end`;
}
