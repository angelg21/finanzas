import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL. Copia .env.example a .env.local.");
}

// En desarrollo Next recarga módulos con cada cambio; reutilizamos la conexión
// para no abrir una nueva en cada recarga.
const globalParaDb = globalThis as unknown as { conexionPg?: postgres.Sql };

const conexion =
  globalParaDb.conexionPg ??
  postgres(process.env.DATABASE_URL, {
    // Necesario para el pooler de Supabase en modo transacción; inocuo en local.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalParaDb.conexionPg = conexion;

export const db = drizzle(conexion, { schema, casing: "snake_case" });
export * from "./schema";
