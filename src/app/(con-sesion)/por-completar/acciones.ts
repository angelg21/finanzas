"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { descartarPorCompletar } from "@/db/por-completar";
import { mensajeDeFalla } from "@/lib/fallas";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";

export type EstadoDescartar = { error?: string };

/** Descarta un pendiente (spec 009, criterio 4). Si ya no estaba, vuelve a la lista igual. */
export async function descartarAccion(_previo: EstadoDescartar, datos: FormData): Promise<EstadoDescartar> {
  const sesion = await leerSesion();
  if (!sesion) return { error: mensajeDeFalla("sesion", "no se descartó") };
  const id = Number(datos.get("id"));
  try {
    await descartarPorCompletar(id);
  } catch (error) {
    registrarFalla("No se pudo descartar el pendiente", error);
    return { error: mensajeDeFalla("otra", "no se descartó") };
  }
  for (const ruta of ["/", "/nuevo", "/por-completar"]) revalidatePath(ruta);
  redirect("/por-completar?descartado=1");
}
