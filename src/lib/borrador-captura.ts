/**
 * Lo escrito en la captura de gasto sobrevive a crear una categoría con la píldora "Nueva" (spec 001,
 * criterio 25). Perder el monto y la forma de pago podía guardar 2.100 USDT en vez de 2.100 Bs.
 * El borrador se guarda en la pestaña al tocar "Nueva", se recupera al volver a la captura por cualquier
 * camino y se olvida al guardar el gasto. Nunca viaja en la dirección: recargar después de guardar no lo
 * trae de vuelta, y un gasto guardado no queda a un toque de repetirse. Caduca a los 30 minutos. La vuelta tras crear o
 * restaurar solo acepta rutas conocidas: nunca otro sitio.
 */

const campos = ["forma", "monto", "tasa", "vendido", "cuenta", "venta", "sobre", "fecha", "nota"] as const;
type Campo = (typeof campos)[number];

export type BorradorCaptura = Partial<Record<Campo, string>>;

/** Los mismos límites que la acción: un valor más largo no se recorta, se descarta (un monto cortado cambia). */
const largoMaximo = (campo: Campo) => (campo === "nota" ? 200 : 30);
const vigencia = 30 * 60_000;

/** El borrador como texto para la pestaña: solo los campos con algo, y cuándo se guardó. */
export function borradorATexto(borrador: BorradorCaptura, ahora: number): string {
  const guardado: Record<string, string | number> = { guardado: ahora };
  for (const campo of campos) {
    const valor = borrador[campo];
    if (valor) guardado[campo] = valor;
  }
  return JSON.stringify(guardado);
}

/**
 * El borrador guardado si tiene hasta 30 minutos y algo útil; si no, null. Solo textos del borrador dentro
 * de su largo: lo demás se ignora, porque la pestaña también la puede escribir otro código.
 */
export function borradorDesdeTexto(texto: string | null, ahora: number): BorradorCaptura | null {
  let leido: unknown;
  try {
    leido = JSON.parse(texto ?? "");
  } catch {
    return null;
  }
  if (typeof leido !== "object" || leido === null || Array.isArray(leido)) return null;
  const datos = leido as Record<string, unknown>;
  const edad = typeof datos.guardado === "number" ? ahora - datos.guardado : -1;
  if (edad < 0 || edad > vigencia) return null;
  const borrador: BorradorCaptura = {};
  for (const campo of campos) {
    const valor = datos[campo];
    if (typeof valor === "string" && valor !== "" && valor.length <= largoMaximo(campo)) borrador[campo] = valor;
  }
  return Object.keys(borrador).length > 0 ? borrador : null;
}

const base = "http://local.invalid";

/** La dirección a la que se vuelve si es una de las rutas permitidas de este mismo sitio; si no, null. */
function leerVuelta(volver: string, rutas: readonly string[]): URL | null {
  // Solo rutas relativas a la raíz: "//otro.com" y "\\otro.com" son de otro sitio para el navegador.
  if (!volver.startsWith("/") || volver.startsWith("//") || volver.startsWith("/\\")) return null;
  const url = new URL(volver, base);
  return url.origin === base && rutas.includes(url.pathname) ? url : null;
}

export function esVuelta(volver: string, rutas: readonly string[]): boolean {
  return leerVuelta(volver, rutas) !== null;
}

/** Tras crear o restaurar una categoría: la vuelta con lo escrito y la categoría elegida, o null. */
export function vueltaConCategoria(volver: string, categoriaId: number, rutas: readonly string[]): string | null {
  const url = leerVuelta(volver, rutas);
  if (!url) return null;
  url.searchParams.set("categoria", String(categoriaId));
  return `${url.pathname}${url.search}`;
}
