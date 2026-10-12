/**
 * Lo escrito en la captura de gasto viaja en la dirección al ir a crear una categoría con la píldora "Nueva"
 * y vuelve con ella (spec 001, criterio 25). Perder el monto y la forma de pago podía guardar 2.100 USDT en
 * vez de 2.100 Bs. La vuelta solo acepta rutas conocidas: nunca otro sitio.
 */

const campos = ["forma", "monto", "tasa", "vendido", "cuenta", "venta", "sobre", "fecha", "nota"] as const;
type Campo = (typeof campos)[number];

export type BorradorCaptura = Partial<Record<Campo, string>>;

/** Los mismos límites que la acción: un valor más largo no se recorta, se descarta (un monto cortado cambia). */
const largoMaximo = (campo: Campo) => (campo === "nota" ? 200 : 30);

/** La ruta de la captura con lo escrito: solo los campos con algo. */
export function direccionConBorrador(ruta: string, borrador: BorradorCaptura): string {
  const parametros = new URLSearchParams();
  for (const campo of campos) {
    const valor = borrador[campo];
    if (valor) parametros.set(campo, valor);
  }
  const consulta = parametros.toString();
  return consulta ? `${ruta}?${consulta}` : ruta;
}

/** Lo escrito que llega en la dirección: solo textos del borrador dentro de su largo; lo demás se ignora. */
export function borradorDesdeParametros(parametros: Record<string, string | string[] | undefined>): BorradorCaptura {
  const borrador: BorradorCaptura = {};
  for (const campo of campos) {
    const valor = parametros[campo];
    if (typeof valor === "string" && valor !== "" && valor.length <= largoMaximo(campo)) borrador[campo] = valor;
  }
  return borrador;
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
