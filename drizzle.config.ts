import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
// Import relativo: drizzle-kit carga este archivo sin los alias de tsconfig.
import { exigirBaseLocal } from "./src/lib/destino-base";

config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  // drizzle-kit (generate, migrate, studio) solo contra la base local; producción: pnpm db:migrate:produccion.
  dbCredentials: { url: exigirBaseLocal(process.env.DATABASE_URL, "drizzle-kit") },
});
