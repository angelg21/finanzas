import { etiquetaPorId } from "@/db/etiquetas";
import { type EtiquetaPedida, leerIdEtiqueta, nombreDeEtiqueta } from "@/lib/etiquetas";

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

/**
 * La etiqueta que pide el formulario de un gasto o un ingreso (spec 008), sin escribir nada: lo escrito en
 * "etiquetaNueva" manda y se valida; si no, la píldora elegida, que tiene que existir. Sin ninguna de las dos,
 * ninguna, y sin tocar la base: la captura de gasto no se vuelve más lenta (criterio 7). La etiqueta nueva la crea
 * la transacción que guarda el movimiento, después de lo que puede rechazarlo: un formulario que no se guarda no
 * deja etiquetas (revisión de la 006, hallazgo 1).
 */
export async function etiquetaDelFormulario(
  datos: FormData,
): Promise<{ ok: true; etiqueta: EtiquetaPedida } | { ok: false; error: string }> {
  const nueva = texto(datos, "etiquetaNueva");
  if (nueva.trim() !== "") {
    const nombre = nombreDeEtiqueta(nueva);
    return nombre.ok ? { ok: true, etiqueta: { nueva: nombre.nombre } } : { ok: false, error: nombre.error };
  }
  const id = leerIdEtiqueta(texto(datos, "etiquetaId"));
  if (id === null) return { ok: true, etiqueta: null };
  const etiqueta = await etiquetaPorId(id);
  return etiqueta ? { ok: true, etiqueta: { id: etiqueta.id } } : { ok: false, error: "Esa etiqueta ya no existe" };
}
