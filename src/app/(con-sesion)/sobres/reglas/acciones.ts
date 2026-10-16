"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardarReglas, reglasPorSobre } from "@/db/reglas";
import { mensajeDeFalla } from "@/lib/fallas";
import { type EntradaRegla, reglaEditable, validarReglas, validarTope } from "@/lib/reglas";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type ErroresFormularioReglas, type EstadoReglas, type ResultadoReglas, tecleadoDe } from "./valores";

const texto = z.string().trim().max(30, "Ese número es demasiado largo");
const esquema = z.object({
  reglas: z
    .record(z.string(), z.object({ tipo: z.string().max(20), valor: texto }))
    .refine((r) => Object.keys(r).length <= 50, "Demasiados sobres"),
  tope: texto,
});

/** Guarda las reglas de reparto (spec 004, criterio 11). Para `useActionState`. */
export async function guardarReglasDeReparto(previo: EstadoReglas, formData: FormData): Promise<EstadoReglas> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", "las reglas no se guardaron");
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(formData) };
  }
  return { ronda: (previo?.ronda ?? 0) + 1, ...(await procesarReglas(formData)) };
}

/**
 * Los sobres editables salen de la base, no del formulario: los activos, sin "Por asignar" ni los fondos, cuyo aporte
 * se cambia en su desglose. Un sobre editable que no llegó en el envío queda como "ninguna" y lo dice su campo.
 */
async function procesarReglas(formData: FormData): Promise<ResultadoReglas> {
  const leido = esquema.safeParse(tecleadoDe(formData));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa las reglas";
    return { estado: "error", errores: { general }, valores: tecleadoDe(formData) };
  }
  const valores = leido.data;

  const sobres = await reglasPorSobre();
  const editables = sobres.filter((s) => reglaEditable(s.tipoSobre));
  const entradas: EntradaRegla[] = editables.map((s) => {
    const enviada = valores.reglas[s.sobreId];
    return { sobreId: s.sobreId, tipo: (enviada?.tipo ?? "") as EntradaRegla["tipo"], valor: enviada?.valor ?? "" };
  });
  const reglas = validarReglas(entradas);
  const emergencia = sobres.find((s) => s.tipoSobre === "emergencia");
  const tope = emergencia ? validarTope(valores.tope) : null;

  const errores: ErroresFormularioReglas = reglas.ok ? {} : { ...reglas.errores };
  if (tope && !tope.ok) errores.tope = tope.error;
  if (!reglas.ok || (tope && !tope.ok)) return { estado: "error", errores, valores };

  try {
    await guardarReglas(reglas.reglas, tope?.ok ? tope.centavos : null);
  } catch (error) {
    registrarFalla("No se pudieron guardar las reglas", error);
    return { estado: "error", errores: { general: "No se pudo guardar. Intenta de nuevo." }, valores };
  }

  for (const ruta of ["/", "/sobres", "/sobres/reglas", "/sobres/repartir", "/nuevo/ingreso"]) revalidatePath(ruta);
  return { estado: "guardado", valores, sinPorcentajes: reglas.sinPorcentajes };
}
