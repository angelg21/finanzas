/**
 * El historial de Gestor de Gastos (spec 012), leído de su .xlsx y convertido en movimientos de la app. Entra como
 * historial: sale en Movimientos y en las gráficas, pero no mueve ningún saldo (src/db/sumas-de-saldo.ts). Lo que no
 * se puede leer sin adivinar es un error y no se importa nada; lo que ya está en la app o se pidió omitir, se salta
 * con su motivo.
 */
import { claveDeNombre, colorPorDefecto, iconoPorDefecto, type TipoCategoria } from "./categorias";
import { nombreDeEtiqueta } from "./etiquetas";
import type { FilaExportada, Hoja } from "./leer-exportacion";

/**
 * El comienzo de la referencia de todo lo importado como historial: con origen "importado", lo distingue de los datos de
 * demostración (que también lo son, con "demo-") y de lo que importe otra fuente. No mueve saldos (src/db/sumas-de-saldo.ts).
 */
export const prefijoDeHistorial = "historial-";

export type CuentaNueva = { nombre: string; moneda: "USD" | "USDT" | "USDC"; tipo: "billetera" | "banco" | "exchange" };
export type Aspecto = { icono: string; color: string };

/** Qué es cada cosa de la app vieja en esta, y lo que no se trae. */
export type Mapeo = {
  cuentas: Record<string, string>;
  /** Las que no existen todavía y se crean al importar. */
  cuentasNuevas: CuentaNueva[];
  /** Solo las que cambian de nombre; las demás van a la categoría que se llame igual, o se crean. */
  categorias: Record<TipoCategoria, Record<string, string>>;
  aspecto: Record<string, Aspecto>;
  omitir: { hoja: Hoja; fecha: string; centavosUsd: number; motivo: string }[];
};

export type ContextoDeImportacion = {
  cuentas: { nombre: string; moneda: string }[];
  categorias: { nombre: string; tipo: TipoCategoria }[];
  etiquetas: { nombre: string }[];
  /** Gastos e ingresos que no son historial: lo que ya se anotó en la app no se trae otra vez. */
  yaAnotados: { fecha: string; tipo: "gasto" | "ingreso"; centavosUsd: number; nota: string | null }[];
};

export type MovimientoImportado = {
  /** "historial-gastos-2026-10-13-1800-1": la misma fila da la misma referencia, y la base no la acepta dos veces. */
  referencia: string;
  tipo: "gasto" | "ingreso" | "transferencia";
  fecha: string;
  /** Nombres como están en la app, o como se crearán. */
  cuenta: string;
  destino: string | null;
  categoria: string | null;
  etiqueta: string | null;
  montoCentavos: number;
  moneda: string;
  montoUsdCentavos: number;
  montoDestinoCentavos: number | null;
  monedaDestino: string | null;
  nota: string | null;
};

export type Omitida = Pick<FilaExportada, "hoja" | "fila" | "fecha" | "centavosUsd" | "nota"> & { motivo: string };

export type PlanDeImportacion = {
  movimientos: MovimientoImportado[];
  crear: {
    cuentas: CuentaNueva[];
    categorias: ({ nombre: string; tipo: TipoCategoria } & Aspecto)[];
    etiquetas: string[];
  };
  equivalencias: { tipo: "cuenta" | TipoCategoria; vieja: string; nueva: string; existe: boolean }[];
  omitidas: Omitida[];
  errores: string[];
};

const dolares = new Set(["USD", "USDT", "USDC"]);
const tipoDe = { gastos: "gasto", ingresos: "ingreso", transferencias: "transferencia" } as const;

/** Los movimientos a insertar, lo que hay que crear antes y lo que se salta. Con errores no se importa nada. */
export function planDeImportacion(
  filas: FilaExportada[],
  contexto: ContextoDeImportacion,
  mapeo: Mapeo,
): PlanDeImportacion {
  const plan: PlanDeImportacion = {
    movimientos: [],
    crear: { cuentas: [], categorias: [], etiquetas: [] },
    equivalencias: [],
    omitidas: [],
    errores: [],
  };
  const vistas = new Set<string>();
  const equivalencia = (tipo: "cuenta" | TipoCategoria, vieja: string, nueva: string, existe: boolean) => {
    if (vistas.has(`${tipo}|${vieja}`)) return;
    vistas.add(`${tipo}|${vieja}`);
    plan.equivalencias.push({ tipo, vieja, nueva, existe });
  };

  const cuentaDe = (vieja: string): { nombre: string; moneda: string } | null => {
    const nueva = mapeo.cuentas[vieja];
    if (!nueva) {
      plan.errores.push(`La cuenta «${vieja}» de la app vieja no tiene equivalente: no se adivina.`);
      return null;
    }
    const existente = contexto.cuentas.find((c) => claveDeNombre(c.nombre) === claveDeNombre(nueva));
    equivalencia("cuenta", vieja, existente?.nombre ?? nueva, Boolean(existente));
    if (existente) return existente;
    const porCrear = mapeo.cuentasNuevas.find((c) => claveDeNombre(c.nombre) === claveDeNombre(nueva));
    if (!porCrear) {
      plan.errores.push(`La cuenta «${nueva}» no existe en la app.`);
      return null;
    }
    if (!plan.crear.cuentas.includes(porCrear)) plan.crear.cuentas.push(porCrear);
    return porCrear;
  };

  const categoriaDe = (tipo: TipoCategoria, vieja: string): string => {
    const nueva = mapeo.categorias[tipo][vieja] ?? vieja;
    const clave = claveDeNombre(nueva);
    const existente = contexto.categorias.find((c) => c.tipo === tipo && claveDeNombre(c.nombre) === clave);
    equivalencia(tipo, vieja, existente?.nombre ?? nueva, Boolean(existente));
    if (existente) return existente.nombre;
    const yaPedida = plan.crear.categorias.find((c) => c.tipo === tipo && claveDeNombre(c.nombre) === clave);
    if (!yaPedida) {
      const aspecto = mapeo.aspecto[nueva] ?? { icono: iconoPorDefecto, color: colorPorDefecto };
      plan.crear.categorias.push({ nombre: nueva, tipo, ...aspecto });
    }
    return yaPedida?.nombre ?? nueva;
  };

  const etiquetaDe = (pedida: string): string | null => {
    const leida = nombreDeEtiqueta(pedida);
    if (!leida.ok) {
      plan.errores.push(`La etiqueta «${pedida}»: ${leida.error}.`);
      return null;
    }
    const existente = contexto.etiquetas.find((e) => claveDeNombre(e.nombre) === leida.clave);
    if (existente) return existente.nombre;
    const yaPedida = plan.crear.etiquetas.find((e) => claveDeNombre(e) === leida.clave);
    if (!yaPedida) plan.crear.etiquetas.push(leida.nombre);
    return yaPedida ?? leida.nombre;
  };

  const yaAnotados = [...contexto.yaAnotados];
  const repeticiones = new Map<string, number>();
  for (const f of filas) {
    const llave = `${prefijoDeHistorial}${f.hoja}-${f.fecha}-${f.centavosUsd}`;
    const vez = (repeticiones.get(llave) ?? 0) + 1;
    repeticiones.set(llave, vez);
    const tipo = tipoDe[f.hoja];
    const omitir = (motivo: string) =>
      plan.omitidas.push({
        hoja: f.hoja,
        fila: f.fila,
        fecha: f.fecha,
        centavosUsd: f.centavosUsd,
        nota: f.nota,
        motivo,
      });

    const pedida = mapeo.omitir.find(
      (o) => o.hoja === f.hoja && o.fecha === f.fecha && o.centavosUsd === f.centavosUsd,
    );
    if (pedida) {
      omitir(pedida.motivo);
      continue;
    }
    const anotado = yaAnotados.findIndex(
      (y) => y.tipo === tipo && y.fecha === f.fecha && y.centavosUsd === f.centavosUsd,
    );
    if (anotado >= 0) {
      omitir(`Ya está en la app: «${yaAnotados[anotado].nota ?? "sin nota"}»`);
      yaAnotados.splice(anotado, 1);
      continue;
    }

    const cuenta = cuentaDe(f.cuenta);
    if (!cuenta) continue;
    const compatible = f.monedaCuenta === "VES" ? cuenta.moneda === "VES" : dolares.has(cuenta.moneda);
    if (!compatible) {
      plan.errores.push(
        `${f.hoja}, fila ${f.fila}: «${f.cuenta}» en ${f.monedaCuenta} no cabe en ${cuenta.nombre} (${cuenta.moneda}).`,
      );
      continue;
    }
    const base = {
      referencia: `${llave}-${vez}`,
      tipo,
      fecha: f.fecha,
      cuenta: cuenta.nombre,
      montoCentavos: f.centavosCuenta,
      moneda: cuenta.moneda,
      montoUsdCentavos: f.centavosUsd,
      nota: f.nota,
    };

    if (tipo === "transferencia") {
      const destino = f.destino ? cuentaDe(f.destino) : null;
      if (!destino) {
        if (!f.destino) plan.errores.push(`transferencias, fila ${f.fila}: no dice la cuenta que recibe.`);
        continue;
      }
      if (destino.nombre === cuenta.nombre) {
        omitir(`Entre ${f.cuenta} y ${f.destino}: aquí son la misma cuenta`);
        continue;
      }
      if (!dolares.has(destino.moneda)) {
        plan.errores.push(`transferencias, fila ${f.fila}: a ${destino.nombre} sería una venta de bolívares.`);
        continue;
      }
      const otraMoneda = destino.moneda !== cuenta.moneda;
      plan.movimientos.push({
        ...base,
        destino: destino.nombre,
        categoria: null,
        etiqueta: null,
        montoDestinoCentavos: otraMoneda ? (f.centavosDestino ?? f.centavosCuenta) : null,
        monedaDestino: otraMoneda ? destino.moneda : null,
      });
      continue;
    }

    if (!f.categoria) {
      plan.errores.push(`${f.hoja}, fila ${f.fila}: no dice la categoría.`);
      continue;
    }
    plan.movimientos.push({
      ...base,
      destino: null,
      categoria: categoriaDe(tipo, f.categoria),
      etiqueta: f.etiqueta ? etiquetaDe(f.etiqueta) : null,
      montoDestinoCentavos: null,
      monedaDestino: null,
    });
  }
  return plan;
}
