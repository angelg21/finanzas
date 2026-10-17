/**
 * Periodos de la pantalla de movimientos (spec 003): día, semana de lunes a domingo, mes y año, sobre la fecha del
 * movimiento ("AAAA-MM-DD", que ya es el día de Caracas). Y los filtros de la dirección: ningún parámetro llega a
 * una consulta sin pasar por `leerFiltros`, y uno inválido cae en Gastos del mes de hoy sin romper la página.
 */
import { diaAnterior, fechaLarga, fechaValida, moverMes, nombreMes } from "./fechas";

export type TipoPeriodo = "dia" | "semana" | "mes" | "anio";
export const tiposPeriodo: readonly TipoPeriodo[] = ["dia", "semana", "mes", "anio"];

export type PestanaMovimientos = "gastos" | "ingresos" | "mover";
export const pestanasMovimientos: readonly PestanaMovimientos[] = ["gastos", "ingresos", "mover"];

/** Extremos inclusivos, en "AAAA-MM-DD". */
export type Rango = { desde: string; hasta: string };

export type Filtros = {
  pestana: PestanaMovimientos;
  periodo: TipoPeriodo;
  /** El día de referencia del periodo: nunca futuro. */
  fecha: string;
  categoria: number | null;
};

/** El mayor id de una columna integer de Postgres. */
const TOPE_ID = 2_147_483_647;

const dosCifras = (n: number) => String(n).padStart(2, "0");
// El año con sus cuatro cifras también antes del 1000: "0100-06-01", no "100-06-01", que esFecha rechaza.
const cuatroCifras = (n: number) => String(n).padStart(4, "0");
const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

function partes(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return { anio, mes, dia };
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** El mismo día en otro mes, o el último si ese mes es más corto: el 31 de enero más un mes es el 28 de febrero. */
function diaEnMes(anio: number, mes: number, dia: number): string {
  return `${cuatroCifras(anio)}-${dosCifras(mes)}-${dosCifras(Math.min(dia, ultimoDia(anio, mes)))}`;
}

export function rangoDePeriodo(tipo: TipoPeriodo, ancla: string): Rango {
  const { anio, mes } = partes(ancla);
  switch (tipo) {
    case "dia":
      return { desde: ancla, hasta: ancla };
    case "semana": {
      const desdeLunes = (new Date(`${ancla}T00:00:00Z`).getUTCDay() + 6) % 7;
      const lunes = sumarDias(ancla, -desdeLunes);
      return { desde: lunes, hasta: sumarDias(lunes, 6) };
    }
    case "mes":
      return { desde: `${cuatroCifras(anio)}-${dosCifras(mes)}-01`, hasta: diaEnMes(anio, mes, 31) };
    case "anio":
      return { desde: `${cuatroCifras(anio)}-01-01`, hasta: `${cuatroCifras(anio)}-12-31` };
  }
}

/** El día de referencia del periodo anterior (−1) o siguiente (+1), sin pasar de `hoy`. */
export function moverPeriodo(tipo: TipoPeriodo, ancla: string, delta: number, hoy: string): string {
  const { anio, mes, dia } = partes(ancla);
  let movida: string;
  if (tipo === "dia") movida = sumarDias(ancla, delta);
  else if (tipo === "semana") movida = sumarDias(ancla, delta * 7);
  else if (tipo === "mes") {
    const destino = moverMes({ anio, mes }, delta);
    movida = diaEnMes(destino.anio, destino.mes, dia);
  } else movida = diaEnMes(anio + delta, mes, dia);
  // Mismo formato de ancho fijo: comparar como texto es comparar como fecha.
  return movida > hoy ? hoy : movida;
}

/** Si `hoy` cae dentro del periodo: entonces no hay siguiente. */
export function esPeriodoActual(tipo: TipoPeriodo, ancla: string, hoy: string): boolean {
  const { desde, hasta } = rangoDePeriodo(tipo, ancla);
  return hoy >= desde && hoy <= hasta;
}

/** "Hoy", "Ayer", "Lunes 12 de octubre", o con el año si no es el de hoy. */
export function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === diaAnterior(hoy)) return "Ayer";
  const larga = fechaLarga(fecha);
  return mayuscula(fecha.slice(0, 4) === hoy.slice(0, 4) ? larga.replace(/ de \d{4}$/, "") : larga);
}

const mesCorto = (mes: number) => nombreMes(mes).slice(0, 3).toLowerCase();

/** "Hoy", "12 – 18 oct 2026", "Octubre de 2026" o "2026". */
export function etiquetaPeriodo(tipo: TipoPeriodo, ancla: string, hoy: string): string {
  const { anio, mes } = partes(ancla);
  switch (tipo) {
    case "dia":
      return etiquetaDia(ancla, hoy);
    case "mes":
      return `${nombreMes(mes)} de ${anio}`;
    case "anio":
      return String(anio);
    case "semana": {
      const { desde, hasta } = rangoDePeriodo("semana", ancla);
      const a = partes(desde);
      const b = partes(hasta);
      const fin = `${b.dia} ${mesCorto(b.mes)} ${b.anio}`;
      if (a.anio !== b.anio) return `${a.dia} ${mesCorto(a.mes)} ${a.anio} – ${fin}`;
      if (a.mes !== b.mes) return `${a.dia} ${mesCorto(a.mes)} – ${fin}`;
      return `${a.dia} – ${fin}`;
    }
  }
}

/** Solo un valor de texto: un parámetro repetido (`?tipo=a&tipo=b`) no vale. */
const uno = (valor: string | string[] | undefined) => (typeof valor === "string" ? valor : undefined);

/** Los filtros de `/movimientos` a partir de los parámetros de la dirección, cada uno validado o en su defecto. */
export function leerFiltros(parametros: Record<string, string | string[] | undefined>, hoy: string): Filtros {
  const tipo = uno(parametros.tipo);
  const pestana = pestanasMovimientos.find((p) => p === tipo) ?? "gastos";
  const textoPeriodo = uno(parametros.periodo);
  const periodo = tiposPeriodo.find((p) => p === textoPeriodo) ?? "mes";
  const textoFecha = uno(parametros.fecha);
  const fecha = textoFecha !== undefined && fechaValida(textoFecha, hoy) ? textoFecha : hoy;
  const textoCategoria = uno(parametros.categoria);
  const categoria =
    pestana !== "mover" &&
    textoCategoria !== undefined &&
    /^[1-9]\d{0,9}$/.test(textoCategoria) &&
    Number(textoCategoria) <= TOPE_ID
      ? Number(textoCategoria)
      : null;
  return { pestana, periodo, fecha, categoria };
}

/** La parte "?..." de la dirección para unos filtros, sin lo que vale por defecto. */
export function consultaDeFiltros(filtros: Filtros, hoy: string): string {
  const parametros = new URLSearchParams();
  if (filtros.pestana !== "gastos") parametros.set("tipo", filtros.pestana);
  if (filtros.periodo !== "mes") parametros.set("periodo", filtros.periodo);
  if (filtros.fecha !== hoy) parametros.set("fecha", filtros.fecha);
  if (filtros.categoria !== null) parametros.set("categoria", String(filtros.categoria));
  const texto = parametros.toString();
  return texto ? `?${texto}` : "";
}
