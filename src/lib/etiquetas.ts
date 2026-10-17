/**
 * Etiquetas con # en la nota (spec 007, criterios 4 a 6): "#SAX #Rielco" marca un ingreso por cliente. No son una
 * columna: se leen de la nota. "#sax" y "#SAX" son la misma. La del filtro se valida aquí antes de llegar a una
 * consulta, y solo entonces se arma su patrón.
 */

const valida = /^[\p{L}\p{N}_-]{1,30}$/u;
const enNota = /(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_-]{1,30})/gu;

/** Las etiquetas de una nota, en minúsculas, sin repetir y en el orden en que aparecen. */
export function etiquetasDe(nota: string | null): string[] {
  if (!nota) return [];
  const vistas: string[] = [];
  for (const [, etiqueta] of nota.matchAll(enNota)) {
    const minuscula = etiqueta.toLowerCase();
    if (!vistas.includes(minuscula)) vistas.push(minuscula);
  }
  return vistas;
}

/** La etiqueta pedida en la dirección, sin el # y en minúsculas, o null si no es una etiqueta válida. */
export function leerEtiqueta(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const sinNumeral = valor.startsWith("#") ? valor.slice(1) : valor;
  return valida.test(sinNumeral) ? sinNumeral.toLowerCase() : null;
}

/**
 * El patrón de Postgres (`~*`, sin distinguir mayúsculas) para una etiqueta ya validada por leerEtiqueta: el # con un
 * borde antes y después, para que #sax no encuentre #saxofon. La etiqueta solo trae letras, cifras, _ y -.
 */
export function patronDeEtiqueta(etiqueta: string): string {
  return `(^|[^[:alnum:]_])#${etiqueta}($|[^[:alnum:]_-])`;
}
