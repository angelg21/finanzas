/**
 * Las reglas de reparto como se editan en /sobres/reglas (spec 004, criterio 11). Cada sobre lleva un monto fijo
 * mensual, un porcentaje o ninguna regla. Los porcentajes se escriben con hasta dos decimales y se guardan en puntos
 * base (40 % → 4000), con la misma lectura que los montos; tienen que sumar exactamente 100 %. Es pura: la acción
 * le pasa solo los sobres editables, sin "Por asignar" ni los fondos, cuyo aporte sale de su desglose.
 */
import { centavosATexto, leerExacto, partesCentavos } from "./dinero";
import { cabeEnRegla } from "./fondos";
import { PUNTOS_BASE_TOTAL, type ReglaParaRepartir, type TipoRegla } from "./reparto";

export type EntradaRegla = { sobreId: number; tipo: TipoRegla | "ninguna"; valor: string };

export type ReglaValidada = { sobreId: number; tipo: TipoRegla; valor: number };

/** `sobres`: el error de cada campo, por id de sobre. `total`: el de la suma de los porcentajes. */
export type ErroresReglas = { sobres?: Record<number, string>; total?: string };

/** `sinPorcentajes`: lo que quede tras los fijos se quedará en "Por asignar"; la pantalla lo avisa. */
export type ReglasValidadas =
  { ok: true; reglas: ReglaValidada[]; sinPorcentajes: boolean } | { ok: false; errores: ErroresReglas };

/** Si la regla de un sobre se edita en /sobres/reglas: no la de "Por asignar", ni la de un fondo, que sale de su desglose. */
export function reglaEditable(tipoSobre: string): boolean {
  return tipoSobre !== "por_asignar" && tipoSobre !== "fondo";
}

/** 4000 → "40 %"; 3333 → "33,33 %". */
export function formatearPorcentaje(puntosBase: number): string {
  return `${centavosATexto(puntosBase)} %`;
}

/** 270000 → "2.700"; 18750 → "187,50": sin la unidad ni los centavos en cero, para una pista corta. */
function cifraCorta(centavos: number) {
  return partesCentavos(centavos).numero.replace(/,00$/, "");
}

/**
 * Lo que dice la fila de un sobre en el reparto: "fijo · faltan 250 este mes", "40 %" o "40 % · tope 2.700 · faltan
 * 650". Con lo recibido en el mes de la fecha del ingreso y el saldo del sobre, como la propuesta.
 */
export function pistaDeRegla(regla: ReglaParaRepartir, recibidoEnElMes: number, saldo: number): string {
  const faltaFijo = Math.max(0, regla.valor - recibidoEnElMes);
  const partes = [
    regla.tipo === "porcentaje"
      ? formatearPorcentaje(regla.valor)
      : faltaFijo > 0
        ? `fijo · faltan ${cifraCorta(faltaFijo)} este mes`
        : "fijo · cubierto este mes",
  ];
  if (regla.topeCentavos !== null) {
    const faltaTope = Math.max(0, regla.topeCentavos - saldo);
    partes.push(`tope ${cifraCorta(regla.topeCentavos)}`, faltaTope > 0 ? `faltan ${cifraCorta(faltaTope)}` : "lleno");
  }
  return partes.join(" · ");
}

const mensajes = {
  fijo: { vacio: "Escribe el monto", rango: "Entre 0,01 y 21.474.836,47" },
  porcentaje: { vacio: "Escribe el porcentaje", rango: "Entre 0,01 % y 100 %" },
  decimales: "Usa hasta dos decimales",
  repetido: "Este sobre está repetido",
  tipo: "Elige fijo, porcentaje o ninguna",
};

/** Un texto con hasta dos decimales en centésimas, o el error de su campo. */
function leer(texto: string, vacio: string, rango: string): number | string {
  const leido = leerExacto(texto);
  if (leido.ok) return leido.valor;
  return leido.motivo === "vacio" ? vacio : leido.motivo === "decimales" ? mensajes.decimales : rango;
}

function leerRegla(e: EntradaRegla): number | string {
  if (e.tipo === "fijo") {
    const centavos = leer(e.valor, mensajes.fijo.vacio, mensajes.fijo.rango);
    return typeof centavos === "number" && !cabeEnRegla(centavos) ? mensajes.fijo.rango : centavos;
  }
  const puntos = leer(e.valor, mensajes.porcentaje.vacio, mensajes.porcentaje.rango);
  return typeof puntos === "number" && (puntos < 1 || puntos > PUNTOS_BASE_TOTAL) ? mensajes.porcentaje.rango : puntos;
}

export function validarReglas(entradas: EntradaRegla[]): ReglasValidadas {
  const sobres: Record<number, string> = {};
  const vistos = new Set<number>();
  const reglas: ReglaValidada[] = [];
  for (const e of entradas) {
    if (vistos.has(e.sobreId)) {
      sobres[e.sobreId] = mensajes.repetido;
      continue;
    }
    vistos.add(e.sobreId);
    if (e.tipo === "ninguna") continue;
    if (e.tipo !== "fijo" && e.tipo !== "porcentaje") {
      sobres[e.sobreId] = mensajes.tipo;
      continue;
    }
    const valor = leerRegla(e);
    if (typeof valor === "string") sobres[e.sobreId] = valor;
    else reglas.push({ sobreId: e.sobreId, tipo: e.tipo, valor });
  }
  if (Object.keys(sobres).length > 0) return { ok: false, errores: { sobres } };

  const porcentajes = reglas.filter((r) => r.tipo === "porcentaje");
  const suma = porcentajes.reduce((a, r) => a + r.valor, 0);
  if (porcentajes.length > 0 && suma !== PUNTOS_BASE_TOTAL) {
    return { ok: false, errores: { total: `Los porcentajes suman ${formatearPorcentaje(suma)}; deben sumar 100 %` } };
  }
  return { ok: true, reglas, sinPorcentajes: porcentajes.length === 0 };
}

/** El tope de Emergencia: un monto mayor que cero, con hasta dos decimales. */
export function validarTope(texto: string): { ok: true; centavos: number } | { ok: false; error: string } {
  const centavos = leer(texto, "Escribe el tope", "Escribe un tope mayor que cero");
  if (typeof centavos === "string") return { ok: false, error: centavos };
  if (centavos < 1) return { ok: false, error: "Escribe un tope mayor que cero" };
  return { ok: true, centavos };
}
