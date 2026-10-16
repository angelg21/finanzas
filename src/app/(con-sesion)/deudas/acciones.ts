"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { saldosPorCuenta } from "@/db/consultas";
import { deudaPorId } from "@/db/deudas";
import { borrarDeuda, editarDeuda, registrarDeuda } from "@/db/guardar-deudas";
import { esIdCaptura, resolverReintentoDeDeuda } from "@/lib/captura";
import { type CuentaDeuda, validarDeuda } from "@/lib/deudas";
import { formatearCifra } from "@/lib/dinero";
import { mensajeDeFalla } from "@/lib/fallas";
import { registrarFalla } from "@/app/registro-de-fallas";
import { exigirSesion, leerSesion } from "@/app/sesion";
import { type ErroresFormularioDeuda, type EstadoDeuda, type ValoresDeuda, tecleadoDe } from "./valores";

const esquema = z.object({
  id: z.string().regex(/^\d{0,9}$/, "Esa deuda no existe"),
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  sentido: z.enum(["debo", "me_deben"]),
  persona: z.string().max(200, "Usa hasta 80 caracteres"),
  monto: z.string().trim().max(30, "Ese número es demasiado largo"),
  fechaPrevista: z.string().trim().max(10, "Elige una fecha válida"),
  cuentaPrevistaId: z.string().regex(/^\d{0,9}$/, "Elige una cuenta en dólares"),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
});

const queNoSeGuardo = "la deuda no se guardó";

/** Todo lo que muestra una deuda o depende de lo que se debe: la lista, el detalle, la cuota y el patrimonio. */
function revalidar() {
  for (const ruta of ["/deudas", "/", "/cuentas", "/sobres", "/sobres/reglas", "/sobres/repartir", "/nuevo/ingreso"]) {
    revalidatePath(ruta);
  }
  revalidatePath("/deudas/[id]", "page");
}

/**
 * Registra una deuda que ya existía o corrige una (spec 005, criterios 1 y 16). Para `useActionState`. Con la sesión
 * vencida no redirige: responde con el mensaje y lo tecleado. Al guardar, vuelve a la lista o al detalle.
 */
export async function guardarDeuda(previo: EstadoDeuda, datos: FormData): Promise<EstadoDeuda> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", queNoSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const ronda = (previo?.ronda ?? 0) + 1;
  const resultado = await procesar(datos);
  if ("destino" in resultado) {
    revalidar();
    redirect(resultado.destino);
  }
  return { ronda, ...resultado };
}

type Resultado = { destino: string } | { estado: "error"; errores: ErroresFormularioDeuda; valores: ValoresDeuda };

/** Las cuentas y la deuda se leen de la base: nada del formulario se cree a ciegas. */
async function procesar(datos: FormData): Promise<Resultado> {
  const leido = esquema.safeParse(tecleadoDe(datos));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const valores: ValoresDeuda = leido.data;
  const enDolares: CuentaDeuda[] = (await saldosPorCuenta()).filter((c) => c.moneda !== "VES");
  const entrada = { ...valores, cuentaPrevistaId: valores.cuentaPrevistaId ? Number(valores.cuentaPrevistaId) : null };

  if (valores.id !== "") {
    const id = Number(valores.id);
    const actual = await deudaPorId(id);
    if (!actual) return { estado: "error", errores: { general: "Esa deuda ya no existe" }, valores };
    // El sentido no cambia al editar: manda el guardado, no el formulario.
    const validada = validarDeuda({ ...entrada, sentido: actual.sentido }, enDolares, actual);
    if (!validada.ok) return { estado: "error", errores: validada.errores, valores };
    try {
      const r = await editarDeuda(id, validada.deuda);
      if ("noExiste" in r) return { estado: "error", errores: { general: "Esa deuda ya no existe" }, valores };
      if ("minimoCentavos" in r) {
        const monto = `Con lo que ya se movió, no puede ser menos de ${formatearCifra(r.minimoCentavos)}`;
        return { estado: "error", errores: { monto }, valores };
      }
    } catch (error) {
      registrarFalla("No se pudo editar la deuda", error);
      return { estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
    }
    return { destino: `/deudas/${id}` };
  }

  const validada = validarDeuda(entrada, enDolares);
  if (!validada.ok) return { estado: "error", errores: validada.errores, valores };
  let registro: Awaited<ReturnType<typeof registrarDeuda>>;
  try {
    registro = await registrarDeuda(valores.idCaptura, validada.deuda);
  } catch (error) {
    registrarFalla("No se pudo registrar la deuda", error);
    return { estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
  }
  // Ya había una con este id. Solo es "ya estaba" si es la misma y reciente; si no, se avisa y el id cambia.
  if (!registro.nueva && resolverReintentoDeDeuda(registro.guardada, validada.deuda, new Date()) === "otra") {
    return {
      estado: "error",
      errores: { general: "Esta deuda ya se registró antes: revísala en Deudas y, si es otra, vuelve a guardar." },
      valores: { ...valores, idCaptura: crypto.randomUUID() },
    };
  }
  return { destino: "/deudas" };
}

/** Borra una deuda sin movimientos (criterio 16); con movimientos, la base se niega y se vuelve al detalle. */
export async function borrarDeudaAccion(datos: FormData) {
  await exigirSesion();
  const id = Number(datos.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) redirect("/deudas");
  let resultado: Awaited<ReturnType<typeof borrarDeuda>>;
  try {
    resultado = await borrarDeuda(id);
  } catch (error) {
    registrarFalla("No se pudo borrar la deuda", error);
    throw new Error("No se pudo borrar la deuda.");
  }
  revalidar();
  redirect("conMovimientos" in resultado ? `/deudas/${id}` : "/deudas");
}
