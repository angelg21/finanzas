"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categoriasDeGastoPorUso } from "@/db/consultas";
import { anotarPorCompletar, contarPorCompletar } from "@/db/por-completar";
import { esIdCaptura, referenciaDeCaptura } from "@/lib/captura";
import { mensajeDeFalla } from "@/lib/fallas";
import { fechaDesdeAtajo, hoyEnCaracas } from "@/lib/fechas";
import { validarPorCompletar } from "@/lib/por-completar";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type EstadoPorCompletar, tecleadoDe } from "./valores";

const esquema = z.object({
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  categoriaId: z.string().regex(/^\d{0,9}$/, "Elige una categoría"),
  nota: z.string().trim().max(200, "La descripción admite hasta 200 caracteres"),
  fecha: z.string().trim(),
  monto: z.string().trim().max(30, "Ese número es demasiado largo"),
  moneda: z.string(),
});

const queNoSeGuardo = "no se anotó";

/**
 * Anota un gasto por completar (spec 009, criterios 2 y 3): no mueve dinero. Al anotar, el formulario vuelve vacío
 * para el siguiente, con una captura nueva.
 */
export async function anotarAccion(previo: EstadoPorCompletar, datos: FormData): Promise<EstadoPorCompletar> {
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
  const hoy = hoyEnCaracas(new Date());
  const categorias = await categoriasDeGastoPorUso();
  const validado = validarPorCompletar(
    {
      categoriaId: leido.data.categoriaId ? Number(leido.data.categoriaId) : null,
      nota: leido.data.nota,
      fecha: fechaDesdeAtajo(leido.data.fecha, hoy),
      monto: leido.data.monto,
      moneda: leido.data.moneda,
    },
    categorias.map((c) => c.id),
    hoy,
  );
  if (!validado.ok) return { ronda, estado: "error", errores: validado.errores, valores };
  try {
    await anotarPorCompletar({ ...validado.fila, referencia: referenciaDeCaptura(valores.idCaptura, "pendiente") });
  } catch (error) {
    registrarFalla("No se pudo anotar el gasto por completar", error);
    return { ronda, estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
  }
  for (const ruta of ["/", "/nuevo", "/por-completar"]) revalidatePath(ruta);
  return { ronda, estado: "anotado", cantidad: await contarPorCompletar(), siguienteCaptura: crypto.randomUUID() };
}
