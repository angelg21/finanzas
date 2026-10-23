import { asc, eq, sql } from "drizzle-orm";
import { type EtiquetaPedida, nombreDeEtiqueta } from "../lib/etiquetas";
import { db } from "./index";
import type { Ejecutor } from "./movimientos";
import { etiquetas } from "./schema";

/*
  Etiquetas (spec 008). Se crean desde el formulario del gasto o del ingreso, nunca en una pantalla aparte: al guardar,
  si se escribió una, se busca por su clave y, si no existe, se crea. El índice único de la clave hace que dos
  pestañas que crean "SAX" y "sax" a la vez terminen en la misma.
*/

/** Todas las etiquetas, por nombre, para las píldoras del formulario. */
export async function todasLasEtiquetas() {
  return db
    .select({ id: etiquetas.id, nombre: etiquetas.nombre })
    .from(etiquetas)
    .orderBy(asc(sql`lower(${etiquetas.nombre})`), etiquetas.id);
}

/** Una etiqueta por su id, o null si no existe. */
export async function etiquetaPorId(id: number, ejecutor: Ejecutor = db) {
  const [e] = await ejecutor
    .select({ id: etiquetas.id, nombre: etiquetas.nombre })
    .from(etiquetas)
    .where(eq(etiquetas.id, id));
  return e ?? null;
}

/**
 * La etiqueta con ese nombre, sin importar mayúsculas, acentos ni espacios de más; si no existe, la crea (criterios 1
 * y 3). Lanza si el nombre no es válido: la acción lo valida antes con nombreDeEtiqueta.
 */
export async function buscarOCrearEtiqueta(texto: string, ejecutor: Ejecutor = db) {
  const nombre = nombreDeEtiqueta(texto);
  if (!nombre.ok) throw new Error("Nombre de etiqueta inválido");
  await ejecutor
    .insert(etiquetas)
    .values({ nombre: nombre.nombre, clave: nombre.clave })
    .onConflictDoNothing({ target: etiquetas.clave });
  const [e] = await ejecutor
    .select({ id: etiquetas.id, nombre: etiquetas.nombre })
    .from(etiquetas)
    .where(eq(etiquetas.clave, nombre.clave));
  if (!e) throw new Error("La etiqueta no quedó guardada");
  return e;
}

/**
 * El id de la etiqueta pedida, creándola si hace falta con el ejecutor dado. Se llama dentro de la transacción que
 * guarda el movimiento y después de todo lo que puede rechazarlo: si no se guarda, la etiqueta tampoco queda.
 */
export async function resolverEtiqueta(ejecutor: Ejecutor, pedida: EtiquetaPedida): Promise<number | null> {
  if (pedida === null) return null;
  if ("id" in pedida) return pedida.id;
  return (await buscarOCrearEtiqueta(pedida.nueva, ejecutor)).id;
}
