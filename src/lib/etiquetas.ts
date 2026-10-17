/**
 * Etiquetas (spec 008): una por gasto o ingreso, para marcar de qué cliente viene (SAX, Rielco) y ver cuánto entró por
 * cada una. Se eligen de una lista y se crean en el mismo formulario. "SAX", "sax" y " Sax " son la misma: la clave es
 * la de las categorías, sin mayúsculas, acentos ni espacios de más, y la base la hace única.
 */
import { claveDeNombre } from "./categorias";

const LARGO_MAXIMO = 30;
const idMaximo = 2_147_483_647;

export type NombreDeEtiqueta = { ok: true; nombre: string; clave: string } | { ok: false; error: string };

/** El nombre tal como se escribió, sin espacios de más, y su clave; o el error del campo. */
export function nombreDeEtiqueta(texto: string): NombreDeEtiqueta {
  const nombre = texto.trim().replace(/\s+/g, " ");
  if (nombre === "") return { ok: false, error: "Escribe el nombre de la etiqueta" };
  if (nombre.length > LARGO_MAXIMO) return { ok: false, error: `Hasta ${LARGO_MAXIMO} caracteres` };
  if (/\p{C}/u.test(nombre)) return { ok: false, error: "Usa letras, cifras y signos comunes" };
  return { ok: true, nombre, clave: claveDeNombre(nombre) };
}

/** Las etiquetas cuyo nombre contiene lo escrito, sin importar mayúsculas ni acentos; todas si no se escribió nada. */
export function coincidenConEtiqueta<E extends { nombre: string }>(etiquetas: E[], texto: string): E[] {
  const buscada = claveDeNombre(texto);
  return buscada === "" ? etiquetas : etiquetas.filter((e) => claveDeNombre(e.nombre).includes(buscada));
}

/** La etiqueta que ya existe con ese nombre, para no crear otra. */
export function etiquetaIgual<E extends { nombre: string }>(etiquetas: E[], texto: string): E | undefined {
  const buscada = claveDeNombre(texto);
  return buscada === "" ? undefined : etiquetas.find((e) => claveDeNombre(e.nombre) === buscada);
}

/** El id de `?etiqueta=` o de la píldora elegida: un entero positivo dentro de un integer, o null. */
export function leerIdEtiqueta(valor: unknown): number | null {
  if (typeof valor !== "string" || !/^\d{1,10}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 && id <= idMaximo ? id : null;
}
