import { and, eq, like } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { idDeReferencia, referenciaDeCaptura } from "../lib/captura";
import { claveDeNombre } from "../lib/categorias";
import { type FilaComision, type FilaTransferencia, categoriaDeComisiones } from "../lib/transferencias";
import { db } from "./index";
import { type Ejecutor, esReferenciaRepetida, guardadasDeCaptura, registrarMovimientos } from "./movimientos";
import { type Movimiento, categorias, cuentas, movimientos, sobres } from "./schema";

/*
  Transferir entre cuentas (spec 011): la transferencia y su comisión se escriben juntas, con las referencias de la
  captura ("captura-<id>-envio" y "captura-<id>-comision"), distintas de la venta de USDT de un gasto en bolívares
  ("-transferencia" junto a "-gasto"), para que editar o borrar ese gasto nunca tome una transferencia por su venta.
*/

const idValido = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;

/** La categoría de gasto "Comisiones", o la que se llame igual sin importar mayúsculas ni acentos; si no hay, se crea. */
async function categoriaDeComision(tx: Ejecutor): Promise<number> {
  const clave = claveDeNombre(categoriaDeComisiones);
  const buscar = async () =>
    (
      await tx
        .select({ id: categorias.id, nombre: categorias.nombre })
        .from(categorias)
        .where(eq(categorias.tipo, "gasto"))
    ).find((c) => claveDeNombre(c.nombre) === clave)?.id;
  const existente = await buscar();
  if (existente !== undefined) return existente;
  await tx
    .insert(categorias)
    .values({ nombre: categoriaDeComisiones, tipo: "gasto", icono: "porcentaje", color: "pizarra", orden: 999 })
    .onConflictDoNothing();
  const creada = await buscar();
  if (creada === undefined) throw new Error("No se pudo crear la categoría de comisiones");
  return creada;
}

type ResultadoTransferencia = { nueva: true } | { nueva: false; guardadas: Movimiento[] };

/**
 * Guarda la transferencia y, si la hay, su comisión, en una transacción. Un reintento con el mismo id choca con la
 * referencia y devuelve lo guardado, para que la acción compare antes de decir "ya estaba".
 */
export async function registrarTransferencia(
  idCaptura: string,
  transferencia: FilaTransferencia,
  comision: FilaComision | null,
): Promise<ResultadoTransferencia> {
  try {
    await db.transaction(async (tx) => {
      const filas = [{ ...transferencia, referenciaExterna: referenciaDeCaptura(idCaptura, "envio") }];
      const conComision = comision
        ? [
            {
              ...comision,
              categoriaId: await categoriaDeComision(tx),
              referenciaExterna: referenciaDeCaptura(idCaptura, "comision"),
            },
          ]
        : [];
      await registrarMovimientos([...filas, ...conComision], tx);
    });
    return { nueva: true };
  } catch (error) {
    if (!esReferenciaRepetida(error)) throw error;
    return { nueva: false, guardadas: await guardadasDeCaptura(idCaptura) };
  }
}

const cuentaOrigen = alias(cuentas, "cuenta_origen");
const cuentaDestino = alias(cuentas, "cuenta_destino");

/** Una transferencia entre cuentas, con sus cuentas y su comisión, para deshacerla (spec 011); null si no lo es. */
export async function transferenciaParaDeshacer(id: number) {
  if (!idValido(id)) return null;
  const [t] = await db
    .select({
      id: movimientos.id,
      fecha: movimientos.fecha,
      montoCentavos: movimientos.montoCentavos,
      moneda: movimientos.moneda,
      nota: movimientos.nota,
      referencia: movimientos.referenciaExterna,
      cuentaDestinoId: movimientos.cuentaDestinoId,
      origen: cuentaOrigen.nombre,
      destino: cuentaDestino.nombre,
    })
    .from(movimientos)
    .innerJoin(cuentaOrigen, eq(cuentaOrigen.id, movimientos.cuentaOrigenId))
    .innerJoin(cuentaDestino, eq(cuentaDestino.id, movimientos.cuentaDestinoId))
    .where(
      and(
        eq(movimientos.id, id),
        eq(movimientos.tipo, "transferencia"),
        eq(movimientos.origen, "manual"),
        like(movimientos.referenciaExterna, "captura-%-envio"),
      ),
    );
  const captura = idDeReferencia(t?.referencia ?? null);
  if (!t || !captura) return null;
  const [comision] = await db
    .select({ montoCentavos: movimientos.montoCentavos, sobre: sobres.nombre })
    .from(movimientos)
    .innerJoin(sobres, eq(sobres.id, movimientos.sobreOrigenId))
    .where(
      and(
        eq(movimientos.origen, "manual"),
        eq(movimientos.referenciaExterna, referenciaDeCaptura(captura, "comision")),
      ),
    );
  return { ...t, comision: comision ?? null };
}

export type TransferenciaParaDeshacer = NonNullable<Awaited<ReturnType<typeof transferenciaParaDeshacer>>>;

/**
 * Deshacer una transferencia entre cuentas (spec 011): borra la transferencia y su comisión en una transacción, con
 * las dos filas bloqueadas. Las cuentas y el sobre de la comisión vuelven a como estaban.
 */
export async function deshacerTransferencia(id: number): Promise<{ ok: true } | { noExiste: true }> {
  if (!idValido(id)) return { noExiste: true };
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select({ id: movimientos.id, referencia: movimientos.referenciaExterna })
      .from(movimientos)
      .where(
        and(
          eq(movimientos.id, id),
          eq(movimientos.tipo, "transferencia"),
          eq(movimientos.origen, "manual"),
          like(movimientos.referenciaExterna, "captura-%-envio"),
        ),
      )
      .for("update");
    const captura = idDeReferencia(t?.referencia ?? null);
    if (!t || !captura) return { noExiste: true as const };
    const deLaComision = and(
      eq(movimientos.origen, "manual"),
      eq(movimientos.referenciaExterna, referenciaDeCaptura(captura, "comision")),
    );
    await tx.select({ id: movimientos.id }).from(movimientos).where(deLaComision).for("update");
    await tx.delete(movimientos).where(deLaComision);
    await tx.delete(movimientos).where(eq(movimientos.id, t.id));
    return { ok: true as const };
  });
}
