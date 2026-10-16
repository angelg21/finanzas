import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

/** Todas las tablas que exporta el esquema, también las que se agreguen después. */
const tablas = Object.values(schema)
  .filter((valor) => is(valor, PgTable))
  .map((tabla) => getTableConfig(tabla));

describe("RLS en todas las tablas (spec 002, criterio 9)", () => {
  it("encuentra las tablas del esquema", () => {
    expect(tablas.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "cuentas",
        "sobres",
        "categorias",
        "movimientos",
        "reglas_reparto",
        "partidas_sobre",
        "deudas",
      ]),
    );
  });

  it.each(tablas.map((t) => [t.name, t] as const))("%s tiene RLS activado y ninguna política", (_, tabla) => {
    // Sin políticas, la API de datos de Supabase no lee ni escribe ninguna fila; la app entra como dueña.
    expect(tabla.enableRLS).toBe(true);
    expect(tabla.policies).toEqual([]);
  });
});
