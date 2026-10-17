import { buscarOCrearEtiqueta, etiquetaPorId } from "@/db/etiquetas";
import { leerIdEtiqueta, nombreDeEtiqueta } from "@/lib/etiquetas";

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

/**
 * La etiqueta que trae el formulario de un gasto o un ingreso (spec 008): lo escrito en "etiquetaNueva" manda y se
 * busca o se crea; si no, la píldora elegida, que tiene que existir. Sin ninguna de las dos, ninguna, y sin tocar la
 * base: la captura de gasto no se vuelve más lenta (criterio 7). La acción la llama cuando lo demás ya es válido, para
 * no crear etiquetas de un formulario que no se guarda.
 */
export async function etiquetaDelFormulario(
  datos: FormData,
): Promise<{ ok: true; etiquetaId: number | null } | { ok: false; error: string }> {
  const nueva = texto(datos, "etiquetaNueva");
  if (nueva.trim() !== "") {
    const nombre = nombreDeEtiqueta(nueva);
    if (!nombre.ok) return { ok: false, error: nombre.error };
    return { ok: true, etiquetaId: (await buscarOCrearEtiqueta(nueva)).id };
  }
  const id = leerIdEtiqueta(texto(datos, "etiquetaId"));
  if (id === null) return { ok: true, etiquetaId: null };
  const etiqueta = await etiquetaPorId(id);
  return etiqueta ? { ok: true, etiquetaId: etiqueta.id } : { ok: false, error: "Esa etiqueta ya no existe" };
}
