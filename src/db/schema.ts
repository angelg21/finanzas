/**
 * Modelo de datos, fase 1. Fuente: docs/plan-financiero-y-app.md, sección 4.
 *
 * Reglas que el esquema hace cumplir:
 * - Todos los montos son enteros en centavos. Nunca float.
 * - El dólar es la única unidad de cuenta: todo movimiento guarda su valor en USD.
 * - Un movimiento tiene una forma fija según su tipo (ver el check "movimientos_forma_por_tipo"):
 *     ingreso        → entra a una cuenta y a un sobre (normalmente "Por asignar")
 *     gasto          → sale de una cuenta y de un sobre
 *     transferencia  → mueve dinero real entre dos cuentas, no toca sobres
 *     reasignacion   → mueve propósito entre dos sobres, no toca cuentas
 * - Las columnas se nombran en snake_case en la base (casing: "snake_case" en drizzle.config.ts).
 * - Toda tabla lleva .enableRLS() y ninguna política (spec 002, criterio 9): con la clave publicable de
 *   Supabase no se lee ni se escribe ninguna fila. La app entra como dueña de las tablas y no la afecta.
 *   Lo vigila src/db/schema.test.ts.
 */
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
// Import relativo: drizzle-kit carga este archivo sin los alias de tsconfig.
import { colorPorDefecto, iconoPorDefecto } from "../lib/categorias";

// ---------- Enumeraciones ----------

export const monedaEnum = pgEnum("moneda", ["USD", "USDT", "USDC", "VES"]);
export const tipoCuentaEnum = pgEnum("tipo_cuenta", ["exchange", "billetera", "efectivo", "banco", "transito"]);
export const tipoSobreEnum = pgEnum("tipo_sobre", [
  "por_asignar",
  "gastos",
  "familia",
  "emergencia",
  "meta",
  "inversion",
  /** Fondo de reserva: gastos previsibles pero irregulares (regalos, ocasiones). Aporte fijo mensual, sin tope ni fecha. */
  "fondo",
]);
export const tipoCategoriaEnum = pgEnum("tipo_categoria", ["ingreso", "gasto"]);
export const tipoMovimientoEnum = pgEnum("tipo_movimiento", ["ingreso", "gasto", "transferencia", "reasignacion"]);
export const origenMovimientoEnum = pgEnum("origen_movimiento", ["manual", "telegram", "importado", "binance"]);
export const tipoReglaEnum = pgEnum("tipo_regla", ["fijo", "porcentaje"]);

// ---------- Columnas comunes ----------

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const creadoEn = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const centavos = () => bigint({ mode: "number" });

// ---------- Tablas ----------

/** Dónde está el dinero físicamente: Binance, efectivo, bolívares, cuenta de tránsito. */
export const cuentas = pgTable(
  "cuentas",
  {
    id: id(),
    nombre: text().notNull(),
    moneda: monedaEnum().notNull(),
    tipo: tipoCuentaEnum().notNull(),
    /** false para la cuenta de la prima: marca legal ("a nombre de mi prima"). Igual entra al cuadre con los sobres (ADR 0006). */
    esPropia: boolean().notNull().default(true),
    activa: boolean().notNull().default(true),
    orden: integer().notNull().default(0),
    nota: text(),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("cuentas_nombre_unico").on(t.nombre)],
).enableRLS();

/** Para qué es el dinero. La suma de los sobres es igual a la suma en USD de todas las cuentas (ADR 0006). */
export const sobres = pgTable(
  "sobres",
  {
    id: id(),
    nombre: text().notNull(),
    tipo: tipoSobreEnum().notNull(),
    /** Emergencia: tope al que deja de recibir. Meta: monto objetivo. */
    topeCentavos: centavos(),
    /** Solo metas: mes objetivo, de ahí sale la cuota mensual. */
    fechaObjetivo: date({ mode: "string" }),
    activo: boolean().notNull().default(true),
    orden: integer().notNull().default(0),
    nota: text(),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("sobres_nombre_unico").on(t.nombre)],
).enableRLS();

export const categorias = pgTable(
  "categorias",
  {
    id: id(),
    nombre: text().notNull(),
    tipo: tipoCategoriaEnum().notNull(),
    padreId: integer().references((): AnyPgColumn => categorias.id),
    /**
     * Nombre del icono y del color en el catálogo de src/lib/categorias.ts, nunca un hexadecimal: el color
     * sigue al tema y la paleta puede ajustarse sin tocar datos. Lo valida la aplicación, no un enum.
     */
    icono: text().notNull().default(iconoPorDefecto),
    color: text().notNull().default(colorPorDefecto),
    /** false = archivada: no se ofrece al registrar, pero sus movimientos la conservan. */
    activa: boolean().notNull().default(true),
    orden: integer().notNull().default(0),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("categorias_tipo_nombre_unico").on(t.tipo, t.nombre)],
).enableRLS();

export const movimientos = pgTable(
  "movimientos",
  {
    id: id(),
    fecha: date({ mode: "string" }).notNull(),
    tipo: tipoMovimientoEnum().notNull(),
    /** Monto en la moneda de la cuenta afectada (origen en gasto/transferencia, destino en ingreso). */
    montoCentavos: centavos().notNull(),
    moneda: monedaEnum().notNull(),
    /** Valor del movimiento en dólares. Siempre presente. */
    montoUsdCentavos: centavos().notNull(),
    /** Solo transferencias que cambian de moneda (USDT → VES): lo que recibe la cuenta destino. */
    montoDestinoCentavos: centavos(),
    monedaDestino: monedaEnum(),
    /** Bolívares por dólar usados en este movimiento. Es un dato del movimiento, no una tasa histórica. */
    tasa: numeric({ precision: 14, scale: 4 }),
    cuentaOrigenId: integer().references(() => cuentas.id),
    cuentaDestinoId: integer().references(() => cuentas.id),
    sobreOrigenId: integer().references(() => sobres.id),
    sobreDestinoId: integer().references(() => sobres.id),
    categoriaId: integer().references(() => categorias.id),
    nota: text(),
    origen: origenMovimientoEnum().notNull().default("manual"),
    /**
     * Id en la fuente externa (Gestor de Gastos, Binance), o "captura-<uuid>-<tipo>" en un gasto registrado a mano
     * (src/lib/captura.ts). Evita registrar dos veces lo mismo.
     */
    referenciaExterna: text(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index("movimientos_fecha_idx").on(t.fecha),
    index("movimientos_cuenta_origen_idx").on(t.cuentaOrigenId),
    index("movimientos_cuenta_destino_idx").on(t.cuentaDestinoId),
    index("movimientos_sobre_origen_idx").on(t.sobreOrigenId),
    index("movimientos_sobre_destino_idx").on(t.sobreDestinoId),
    index("movimientos_categoria_idx").on(t.categoriaId),
    uniqueIndex("movimientos_origen_referencia_unico")
      .on(t.origen, t.referenciaExterna)
      .where(sql`${t.referenciaExterna} is not null`),
    check("movimientos_monto_positivo", sql`${t.montoCentavos} > 0 and ${t.montoUsdCentavos} > 0`),
    check(
      "movimientos_forma_por_tipo",
      sql`case ${t.tipo}
        when 'ingreso' then
          ${t.cuentaDestinoId} is not null and ${t.sobreDestinoId} is not null and ${t.categoriaId} is not null
          and ${t.cuentaOrigenId} is null and ${t.sobreOrigenId} is null
        when 'gasto' then
          ${t.cuentaOrigenId} is not null and ${t.sobreOrigenId} is not null and ${t.categoriaId} is not null
          and ${t.cuentaDestinoId} is null and ${t.sobreDestinoId} is null
        when 'transferencia' then
          ${t.cuentaOrigenId} is not null and ${t.cuentaDestinoId} is not null
          and ${t.cuentaOrigenId} <> ${t.cuentaDestinoId}
          and ${t.sobreOrigenId} is null and ${t.sobreDestinoId} is null
        when 'reasignacion' then
          ${t.sobreOrigenId} is not null and ${t.sobreDestinoId} is not null
          and ${t.sobreOrigenId} <> ${t.sobreDestinoId}
          and ${t.cuentaOrigenId} is null and ${t.cuentaDestinoId} is null
      end`,
    ),
  ],
).enableRLS();

/**
 * Cómo se reparte un ingreso entre sobres, en orden.
 * Primero las reglas fijas (gastos del mes, familia), luego las de porcentaje sobre lo que queda.
 * El tope del sobre (emergencia) corta la regla cuando se alcanza.
 */
export const reglasReparto = pgTable(
  "reglas_reparto",
  {
    id: id(),
    orden: integer().notNull(),
    sobreId: integer()
      .notNull()
      .references(() => sobres.id),
    tipo: tipoReglaEnum().notNull(),
    /** fijo: centavos. porcentaje: puntos base, 10000 = 100 %. */
    valor: integer().notNull(),
    activa: boolean().notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [
    uniqueIndex("reglas_reparto_sobre_unico").on(t.sobreId),
    check("reglas_reparto_valor_positivo", sql`${t.valor} > 0`),
    // Un porcentaje nunca pasa de 100 % (spec 004, criterio 12). El fijo lo acota el tipo integer.
    check("reglas_reparto_porcentaje_maximo", sql`${t.tipo} <> 'porcentaje' or ${t.valor} <= 10000`),
  ],
).enableRLS();

/**
 * Desglose anual de un sobre de tipo fondo: cada ocasión prevista con su monto y cuántas veces al año ocurre.
 * El aporte mensual del sobre se calcula como la suma anual entre doce, redondeada al dólar.
 */
export const partidasSobre = pgTable(
  "partidas_sobre",
  {
    id: id(),
    sobreId: integer()
      .notNull()
      .references(() => sobres.id),
    nombre: text().notNull(),
    /** Monto estimado por ocurrencia, en centavos de dólar. */
    montoCentavos: centavos().notNull(),
    vecesPorAnio: integer().notNull().default(1),
    /** Mes en que suele caer, 1 a 12. Opcional. */
    mes: integer(),
    nota: text(),
    activa: boolean().notNull().default(true),
    orden: integer().notNull().default(0),
    creadoEn: creadoEn(),
  },
  (t) => [
    index("partidas_sobre_sobre_idx").on(t.sobreId),
    check("partidas_sobre_monto_positivo", sql`${t.montoCentavos} > 0 and ${t.vecesPorAnio} > 0`),
    check("partidas_sobre_mes_valido", sql`${t.mes} is null or (${t.mes} between 1 and 12)`),
  ],
).enableRLS();

// ---------- Relaciones (para db.query) ----------

export const categoriasRelations = relations(categorias, ({ one, many }) => ({
  padre: one(categorias, {
    fields: [categorias.padreId],
    references: [categorias.id],
    relationName: "subcategorias",
  }),
  hijas: many(categorias, { relationName: "subcategorias" }),
}));

export const movimientosRelations = relations(movimientos, ({ one }) => ({
  cuentaOrigen: one(cuentas, {
    fields: [movimientos.cuentaOrigenId],
    references: [cuentas.id],
    relationName: "movimientosOrigen",
  }),
  cuentaDestino: one(cuentas, {
    fields: [movimientos.cuentaDestinoId],
    references: [cuentas.id],
    relationName: "movimientosDestino",
  }),
  sobreOrigen: one(sobres, {
    fields: [movimientos.sobreOrigenId],
    references: [sobres.id],
    relationName: "reasignacionesOrigen",
  }),
  sobreDestino: one(sobres, {
    fields: [movimientos.sobreDestinoId],
    references: [sobres.id],
    relationName: "reasignacionesDestino",
  }),
  categoria: one(categorias, {
    fields: [movimientos.categoriaId],
    references: [categorias.id],
  }),
}));

export const reglasRepartoRelations = relations(reglasReparto, ({ one }) => ({
  sobre: one(sobres, { fields: [reglasReparto.sobreId], references: [sobres.id] }),
}));

export const partidasSobreRelations = relations(partidasSobre, ({ one }) => ({
  sobre: one(sobres, { fields: [partidasSobre.sobreId], references: [sobres.id] }),
}));

// ---------- Tipos ----------

export type Cuenta = typeof cuentas.$inferSelect;
export type NuevaCuenta = typeof cuentas.$inferInsert;
export type Sobre = typeof sobres.$inferSelect;
export type NuevoSobre = typeof sobres.$inferInsert;
export type Categoria = typeof categorias.$inferSelect;
export type NuevaCategoria = typeof categorias.$inferInsert;
export type Movimiento = typeof movimientos.$inferSelect;
export type NuevoMovimiento = typeof movimientos.$inferInsert;
export type ReglaReparto = typeof reglasReparto.$inferSelect;
export type NuevaReglaReparto = typeof reglasReparto.$inferInsert;
export type PartidaSobre = typeof partidasSobre.$inferSelect;
export type NuevaPartidaSobre = typeof partidasSobre.$inferInsert;
