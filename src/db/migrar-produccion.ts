/**
 * Aplica las migraciones de drizzle/ a producción (spec 002, criterio 11): pnpm db:migrate:produccion. Lo corre el
 * desarrollador, nunca el agente ni el build de Vercel. Usa el mismo migrador que drizzle-kit migrate, que aplica
 * todas las pendientes en una sola transacción. Después revisa la base real con revisarEstadoBase (criterio 9).
 */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { conectar, terminarConError, urlProduccion } from "./conexion-script";
import { revisarEstadoBase } from "./estado-base";

async function main() {
  const { db, conexion } = conectar(await urlProduccion("aplicar las migraciones"));
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migraciones aplicadas.");
  const comprobaciones = await revisarEstadoBase(conexion);
  await conexion.end();
  for (const c of comprobaciones) console.log(`${c.ok ? "✓" : "✗"} ${c.texto}`);
  if (comprobaciones.some((c) => !c.ok)) {
    throw new Error("La base de producción no quedó como exige la spec 002, criterio 9. Revisa docs/despliegue.md.");
  }
}

main().catch(terminarConError);
