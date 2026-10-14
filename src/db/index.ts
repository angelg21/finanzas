import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { esUrlLegible } from "../lib/destino-base";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL. Copia .env.example a .env.local.");
}
// El error de URL inválida del driver repite la cadena entera, contraseña incluida, y acabaría en los registros.
if (!esUrlLegible(process.env.DATABASE_URL)) {
  throw new Error("DATABASE_URL no se entiende. Escapa los caracteres especiales de la contraseña.");
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
