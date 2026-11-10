/**
 * Las filas de la exportación de Gestor de Gastos (spec 012): las hojas Gastos, Ingresos y Transferencias del .xlsx,
 * con la fecha y los montos leídos sin adivinar. Lo que no se lee así es un error de su fila.
 */
import { aCentavosExactos } from "./dinero";
import { fechaValida } from "./fechas";

/** Una celda del .xlsx: texto, o el número como lo escribe el archivo ("67.3", "46308.0"), sin pasar por float. */
export type Celda = string | { numero: string } | null;
export type Hojas = Record<string, Celda[][]>;
export type Hoja = "gastos" | "ingresos" | "transferencias";

export type FilaExportada = {
  hoja: Hoja;
  /** La fila en Excel, para los mensajes: la 3 es la primera con datos. */
  fila: number;
  fecha: string;
  /** De donde sale (gasto, transferencia) o adonde entra (ingreso), con el nombre de la app vieja. */
  cuenta: string;
  destino: string | null;
  categoria: string | null;
  centavosUsd: number;
  monedaCuenta: string;
  centavosCuenta: number;
  /** Lo entrante de una transferencia en su divisa, si el archivo lo trae. */
  centavosDestino: number | null;
  etiqueta: string | null;
  nota: string | null;
};

const cabeceraMovimientos = [
  "Fecha y hora",
  "Categoría",
  "Cuenta",
  "Cantidad en la divisa predeterminada",
  "Divisa predeterminada",
  "Cantidad en la divisa de la cuenta",
  "Divisa de la cuenta",
];
const cabeceraTransferencias = [
  "Fecha y hora",
  "Saliente",
  "Entrante",
  "Cantidad en divisa saliente",
  "Divisa saliente",
  "Cantidad en divisa entrante",
  "Divisa entrante",
  "Comentario",
];
const hojasDelArchivo: [Hoja, string][] = [
  ["gastos", "Gastos"],
  ["ingresos", "Ingresos"],
  ["transferencias", "Transferencias"],
];
const DIA_EN_MS = 86_400_000;
/** El día 0 de las fechas de Excel en Windows. */
const origenExcel = Date.UTC(1899, 11, 30);

const texto = (c: Celda | undefined): string => (c == null ? "" : typeof c === "string" ? c : c.numero).trim();
const opcional = (c: Celda | undefined): string | null => texto(c) || null;

function fechaDeExcel(c: Celda | undefined, hoy: string): string | null {
  const partes = c && typeof c !== "string" ? /^(\d{1,6})(?:\.\d+)?$/.exec(c.numero) : null;
  if (!partes) return null;
  const fecha = new Date(origenExcel + Number(partes[1]) * DIA_EN_MS).toISOString().slice(0, 10);
  return fecha >= "2000-01-01" && fechaValida(fecha, hoy) ? fecha : null;
}

function centavosDe(c: Celda | undefined): number | null {
  if (!c || typeof c === "string") return null;
  try {
    const centavos = aCentavosExactos(c.numero);
    return centavos > 0 ? centavos : null;
  } catch {
    return null;
  }
}

/** Las filas de las tres hojas, o por qué no se pueden leer. Una hoja que falta no trae filas. */
export function leerExportacion(hojas: Hojas, hoy: string): { filas: FilaExportada[]; errores: string[] } {
  const filas: FilaExportada[] = [];
  const errores: string[] = [];
  for (const [hoja, nombre] of hojasDelArchivo) {
    const tabla = hojas[nombre];
    if (!tabla) continue;
    const esperada = hoja === "transferencias" ? cabeceraTransferencias : cabeceraMovimientos;
    if (esperada.some((titulo, i) => texto(tabla[1]?.[i]) !== titulo)) {
      errores.push(`La hoja ${nombre} no tiene las columnas de Gestor de Gastos: no se adivina cuál es cuál.`);
      continue;
    }
    tabla.slice(2).forEach((celdas, i) => {
      const numero = i + 3;
      const error = (motivo: string) => errores.push(`${nombre}, fila ${numero}: ${motivo}`);
      if (celdas.every((c) => texto(c) === "")) return;
      const fecha = fechaDeExcel(celdas[0], hoy);
      if (!fecha) return error("la fecha no es un día válido hasta hoy");
      const transferencia = hoja === "transferencias";
      const centavosUsd = centavosDe(celdas[3]);
      if (centavosUsd === null) return error("el monto no es mayor que cero con hasta dos decimales");
      if (texto(celdas[4]) !== "USD") return error(`la divisa predeterminada es «${texto(celdas[4])}», no USD`);
      const monedaCuenta = transferencia ? "USD" : texto(celdas[6]);
      if (monedaCuenta !== "USD" && monedaCuenta !== "VES") return error(`la divisa «${monedaCuenta}» no se importa`);
      const centavosCuenta = transferencia ? centavosUsd : centavosDe(celdas[5]);
      if (centavosCuenta === null) return error("el monto en la divisa de la cuenta no es mayor que cero");
      const centavosDestino = transferencia && texto(celdas[5]) !== "" ? centavosDe(celdas[5]) : null;
      if (transferencia && texto(celdas[5]) !== "" && centavosDestino === null) return error("el monto entrante");
      const cuenta = texto(celdas[transferencia ? 1 : 2]);
      if (!cuenta) return error("no dice la cuenta");
      filas.push({
        hoja,
        fila: numero,
        fecha,
        cuenta,
        destino: transferencia ? texto(celdas[2]) || null : null,
        categoria: transferencia ? null : texto(celdas[1]) || null,
        centavosUsd,
        monedaCuenta,
        centavosCuenta,
        centavosDestino,
        etiqueta: transferencia ? null : opcional(celdas[9]),
        nota: opcional(celdas[transferencia ? 7 : 10]),
      });
    });
  }
  return { filas, errores };
}
