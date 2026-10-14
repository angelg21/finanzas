import { unstable_rethrow } from "next/navigation";

/**
 * Registra una falla del servidor solo con su contexto y el código de su causa (auditoría T14, hallazgo 7). El error
 * de Drizzle trae la consulta con sus parámetros (montos, notas, nombres) y, si se registra entero o se deja escapar
 * de una acción, Next lo escribe en los registros de Vercel. Las redirecciones y los 404 de Next se relanzan tal cual.
 */
export function registrarFalla(contexto: string, error: unknown) {
  unstable_rethrow(error);
  console.error(contexto, (error as { cause?: { code?: string } } | null)?.cause?.code ?? "sin código");
}
