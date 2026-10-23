"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categoriasDeGastoPorUso } from "@/db/consultas";
import { editarPorCompletar, porCompletarPorId } from "@/db/por-completar";
import { mensajeDeFalla } from "@/lib/fallas";
import { fechaDesdeAtajo, hoyEnCaracas } from "@/lib/fechas";
import { validarPorCompletar } from "@/lib/por-completar";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type EstadoPorCompletar, tecleadoDe } from "../../nuevo/por-completar/valores";

const esquema = z.object({
  categoriaId: z.string().regex(/^\d{0,9}$/, "Elige una categoría"),
  nota: z.string().trim().max(200, "La descripción admite hasta 200 caracteres"),
  fecha: z.string().trim(),
  monto: z.string().trim().max(30, "Ese número es demasiado largo"),
  moneda: z.string(),
});

const queNoSeGuardo = "no se guardó";

/**
 * Corrige un gasto por completar (spec 010, criterios 1 a 3 y 5) con las mismas reglas que al anotar. No mueve dinero.
 * Al guardar vuelve a la lista con "Cambios guardados"; si ya no estaba, con "Ese gasto ya se completó o se descartó".
 */
export async function editarPorCompletarAccion(
  previo: EstadoPorCompletar,
  datos: FormData,
): Promise<EstadoPorCompletar> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", queNoSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const ronda = (previo?.ronda ?? 0) + 1;
  const valores = tecleadoDe(datos);
  const leido = esquema.safeParse(valores);
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { ronda, estado: "error", errores: { general }, valores };
  }
  const [actual, categorias] = await Promise.all([
    porCompletarPorId(Number(datos.get("id"))),
    categoriasDeGastoPorUso(),
  ]);
  if (!actual) redirect("/por-completar?yano=1");
  const hoy = hoyEnCaracas(new Date());
  const validado = validarPorCompletar(
    {
      categoriaId: leido.data.categoriaId ? Number(leido.data.categoriaId) : null,
      nota: leido.data.nota,
      fecha: fechaDesdeAtajo(leido.data.fecha, hoy),
      monto: leido.data.monto,
      moneda: leido.data.moneda,
    },
    // Su categoría vale aunque se haya archivado después de anotarlo (criterio 3).
    [...categorias.map((c) => c.id), actual.categoriaId],
    hoy,
  );
  if (!validado.ok) return { ronda, estado: "error", errores: validado.errores, valores };
  let guardado: boolean;
  try {
    guardado = await editarPorCompletar(actual.id, validado.fila);
  } catch (error) {
    registrarFalla("No se pudo corregir el gasto por completar", error);
    return { ronda, estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
  }
  for (const ruta of ["/", "/nuevo", "/por-completar"]) revalidatePath(ruta);
  redirect(guardado ? "/por-completar?editado=1" : "/por-completar?yano=1");
}
