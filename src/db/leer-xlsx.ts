/**
 * Un .xlsx leído con lo que trae Node (spec 012): el zip con zlib y el XML de cada hoja con expresiones, sin una
 * dependencia para una importación de una vez. Los números quedan como texto ("67.3"): nunca pasan por float.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import type { Celda, Hojas } from "../lib/leer-exportacion";

/** Los archivos del zip por nombre: solo guardados (0) o comprimidos con deflate (8), los que escribe una hoja de cálculo. */
function archivosDelZip(datos: Buffer): Map<string, Buffer> {
  // El final del índice central (0x06054b50) está en los últimos 22 bytes, más un comentario de hasta 64 KB.
  let fin = -1;
  for (let i = datos.length - 22; i >= Math.max(0, datos.length - 65_557) && fin < 0; i--) {
    if (datos.readUInt32LE(i) === 0x06054b50) fin = i;
  }
  if (fin < 0) throw new Error("El archivo no es un .xlsx: no tiene índice de zip.");
  const archivos = new Map<string, Buffer>();
  let p = datos.readUInt32LE(fin + 16);
  for (let n = datos.readUInt16LE(fin + 10); n > 0; n--) {
    if (datos.readUInt32LE(p) !== 0x02014b50) throw new Error("El índice del .xlsx está dañado.");
    const metodo = datos.readUInt16LE(p + 10);
    const comprimido = datos.readUInt32LE(p + 20);
    const largoNombre = datos.readUInt16LE(p + 28);
    const nombre = datos.toString("utf8", p + 46, p + 46 + largoNombre);
    const local = datos.readUInt32LE(p + 42);
    const inicio = local + 30 + datos.readUInt16LE(local + 26) + datos.readUInt16LE(local + 28);
    const crudo = datos.subarray(inicio, inicio + comprimido);
    if (metodo !== 0 && metodo !== 8) throw new Error(`${nombre} usa una compresión que no se lee (${metodo}).`);
    archivos.set(nombre, metodo === 8 ? inflateRawSync(crudo) : crudo);
    p += 46 + largoNombre + datos.readUInt16LE(p + 30) + datos.readUInt16LE(p + 32);
  }
  return archivos;
}

const entidades: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodificar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (todo, e: string) =>
    e.startsWith("#x") || e.startsWith("#X")
      ? String.fromCodePoint(Number.parseInt(e.slice(2), 16))
      : e.startsWith("#")
        ? String.fromCodePoint(Number(e.slice(1)))
        : (entidades[e] ?? todo),
  );
const atributo = (atributos: string, nombre: string) => new RegExp(`\\b${nombre}="([^"]*)"`).exec(atributos)?.[1];
/** El texto de un elemento con sus `<t>`, también si viene en varios tramos con formato. */
const textoDe = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodificar(m[1])).join("");

function columna(referencia: string): number {
  let n = 0;
  for (const letra of /^[A-Z]+/.exec(referencia)?.[0] ?? "") n = n * 26 + letra.charCodeAt(0) - 64;
  return n - 1;
}

function filasDeHoja(xml: string, compartidas: string[]): Celda[][] {
  const filas: Celda[][] = [];
  for (const fila of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(atributo(fila[1], "r"));
    const celdas: Celda[] = [];
    for (const c of (fila[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tipo = atributo(c[1], "t");
      const contenido = c[2] ?? "";
      const valor = /<v>([\s\S]*?)<\/v>/.exec(contenido)?.[1];
      celdas[columna(atributo(c[1], "r") ?? "")] =
        tipo === "s"
          ? (compartidas[Number(valor)] ?? null)
          : tipo === "inlineStr"
            ? textoDe(contenido)
            : valor === undefined
              ? null
              : tipo === "str" || tipo === "b" || tipo === "e"
                ? decodificar(valor)
                : { numero: valor.trim() };
    }
    filas[numero - 1] = Array.from(celdas, (c) => c ?? null);
  }
  return Array.from(filas, (f) => f ?? []);
}

/** Cada hoja del libro por su nombre, con sus filas en su posición (la fila 1 de Excel es la 0). */
export function leerXlsx(ruta: string): Hojas {
  const archivos = archivosDelZip(readFileSync(ruta));
  const leer = (nombre: string) => archivos.get(nombre)?.toString("utf8") ?? "";
  const compartidas = [...leer("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]));
  const destinos = new Map(
    [...leer("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [
      atributo(m[1], "Id"),
      atributo(m[1], "Target") ?? "",
    ]),
  );
  const hojas: Hojas = {};
  for (const hoja of leer("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const destino = destinos.get(atributo(hoja[1], "r:id")) ?? "";
    const ruta = destino.startsWith("/") ? destino.slice(1) : `xl/${destino}`;
    hojas[decodificar(atributo(hoja[1], "name") ?? "")] = filasDeHoja(leer(ruta), compartidas);
  }
  return hojas;
}
