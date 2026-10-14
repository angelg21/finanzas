"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, sobres } from "@/db";
import {
  AporteFueraDeRango,
  agregarPartidaYSincronizar,
  eliminarPartidaYSincronizar,
  fijarReglaFija,
} from "@/db/fondos";
import { aCentavos } from "@/lib/dinero";
import { cabeEnRegla } from "@/lib/fondos";
import { exigirSesion, leerSesion } from "@/app/sesion";
import { mensajeDeFalla } from "@/lib/fallas";

export type EstadoFormulario = { error?: string; ok?: number };

const esquemaPartida = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la ocasión.").max(80, "Nombre demasiado largo."),
  monto: z.string().trim().min(1, "Indica el monto estimado."),
  // Solo cifras: "0x10" o "1e1", que Number sí entiende, no pasan; las veces multiplican dinero.
  veces: z
    .string()
    .regex(/^\d{1,2}$/, "Las veces al año son un número entero.")
    .transform(Number)
    .pipe(z.number().int().min(1, "Al menos una vez al año.").max(52, "Máximo 52 veces al año.")),
  mes: z.union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{1,2}$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(12)),
  ]),
});

const fueraDeRango = "Ese desglose da un aporte mensual demasiado grande.";

function leerMonto(texto: string): number | null {
  try {
    const centavos = aCentavos(texto);
    // Ni una ocasión ni un aporte pueden pasar de lo que cabe en la regla de reparto (integer).
    return cabeEnRegla(centavos) ? centavos : null;
  } catch {
    return null;
  }
}

async function esFondo(sobreId: number) {
  const [s] = await db.select({ tipo: sobres.tipo }).from(sobres).where(eq(sobres.id, sobreId));
  return s?.tipo === "fondo";
}

function revalidar(sobreId: number) {
  revalidatePath(`/sobres/${sobreId}`);
  revalidatePath("/sobres");
  revalidatePath("/");
}

/** Agrega una ocasión al desglose del sobre y recalcula su aporte mensual. */
export async function agregarPartida(
  sobreId: number,
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const sesion = await leerSesion();
  if (!sesion) return { error: mensajeDeFalla("sesion", "no se guardó") };
  if (!Number.isInteger(sobreId) || !(await esFondo(sobreId))) return { error: "Este sobre no admite desglose." };
  const datos = esquemaPartida.safeParse({
    nombre: formData.get("nombre"),
    monto: formData.get("monto"),
    veces: String(formData.get("veces") || "1"),
    mes: formData.get("mes") ?? "",
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const montoCentavos = leerMonto(datos.data.monto);
  if (montoCentavos === null) return { error: "El monto debe ser un número mayor que cero y razonable." };

  try {
    await agregarPartidaYSincronizar({
      sobreId,
      nombre: datos.data.nombre,
      montoCentavos,
      vecesPorAnio: datos.data.veces,
      mes: datos.data.mes === "" ? null : datos.data.mes,
    });
  } catch (error) {
    if (error instanceof AporteFueraDeRango) return { error: fueraDeRango };
    throw error;
  }
  revalidar(sobreId);
  return { ok: Date.now() };
}

/** Quita una ocasión del desglose y recalcula el aporte. */
export async function eliminarPartida(formData: FormData) {
  await exigirSesion();
  const id = Number(formData.get("id"));
  const sobreId = Number(formData.get("sobreId"));
  if (!Number.isInteger(id) || !Number.isInteger(sobreId)) return;
  await eliminarPartidaYSincronizar(id, sobreId);
  revalidar(sobreId);
}

/** Fija el aporte mensual a mano, cuando el sobre no tiene desglose. */
export async function fijarAporteManual(
  sobreId: number,
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const sesion = await leerSesion();
  if (!sesion) return { error: mensajeDeFalla("sesion", "no se guardó") };
  if (!Number.isInteger(sobreId) || !(await esFondo(sobreId))) return { error: "Este sobre no admite aporte fijo." };
  const monto = leerMonto(String(formData.get("monto") ?? ""));
  if (monto === null) return { error: "El aporte debe ser un número mayor que cero y razonable." };
  await fijarReglaFija(sobreId, monto);
  revalidar(sobreId);
  return { ok: Date.now() };
}
