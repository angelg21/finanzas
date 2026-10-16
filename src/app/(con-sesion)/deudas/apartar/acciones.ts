"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { saldosPorSobre } from "@/db/consultas";
import { sobreDeudas } from "@/db/deudas";
import { apartarADeudas } from "@/db/guardar-deudas";
import { guardadasDeCaptura } from "@/db/movimientos";
import { prepararApartado } from "@/lib/apartado";
import { esIdCaptura, referenciaDeReasignacion, resolverReintento } from "@/lib/captura";
import { formatearCifra } from "@/lib/dinero";
import { mensajeDeFalla } from "@/lib/fallas";
import { hoyEnCaracas } from "@/lib/fechas";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type ErroresFormularioApartado, type EstadoApartado, type ValoresApartado, tecleadoDe } from "./valores";

const esquema = z.object({
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  sobreOrigenId: z.string().regex(/^\d{0,9}$/, "Elige de dónde apartar"),
  monto: z.string().trim().max(30, "Ese número es demasiado largo"),
});

const queNoSeGuardo = "no se apartó nada";
const yaGuardado = "Esto ya se apartó antes: revísalo en Deudas y, si es otro, vuelve a guardar.";

/** Lo que cambia al apartar: los dos sobres, la cuota y lo que muestran Deudas y el reparto. */
function revalidar() {
  for (const ruta of [
    "/deudas",
    "/",
    "/sobres",
    "/movimientos",
    "/nuevo/ingreso",
    "/sobres/repartir",
    "/sobres/reglas",
  ]) {
    revalidatePath(ruta);
  }
  revalidatePath("/deudas/[id]", "page");
  revalidatePath("/sobres/[id]", "page");
}

/**
 * Aparta para Deudas lo que ya se tiene en otro sobre (spec 005, criterio 13): una reasignación hacia Deudas. Para
 * `useActionState`. Con la sesión vencida no redirige. Al guardar, vuelve a /deudas.
 */
export async function apartarAccion(previo: EstadoApartado, datos: FormData): Promise<EstadoApartado> {
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

type Resultado =
  { destino: string } | { estado: "error"; errores: ErroresFormularioApartado; valores: ValoresApartado };

/** Deudas y el sobre de origen se leen de la base, con su saldo de ahora. */
async function procesar(datos: FormData): Promise<Resultado> {
  const leido = esquema.safeParse(tecleadoDe(datos));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const valores: ValoresApartado = leido.data;
  const [deudas, sobres] = await Promise.all([sobreDeudas(), saldosPorSobre()]);
  if (!deudas?.activo) {
    return { estado: "error", errores: { general: "No hay un sobre Deudas activo: no se puede apartar" }, valores };
  }
  const hoy = hoyEnCaracas(new Date());
  const entrada = { monto: valores.monto, sobreOrigenId: valores.sobreOrigenId ? Number(valores.sobreOrigenId) : null };
  const referenciaExterna = referenciaDeReasignacion(valores.idCaptura, deudas.id);
  const destino = "/deudas?guardado=apartado";
  const otraVez = { ...valores, idCaptura: crypto.randomUUID() };

  // El reintento se reconoce antes de preparar: si el primer intento vació el origen, prepararApartado ya no lo
  // ofrecería (guardian-datos, T7). Para comparar, los sobres sin el tope de su saldo.
  const previas = await guardadasDeCaptura(valores.idCaptura);
  if (previas.length > 0) {
    const sinTope = sobres.map((s) => ({ ...s, saldoCentavos: Number.MAX_SAFE_INTEGER }));
    const comoFue = prepararApartado(entrada, sinTope, deudas.id, hoy);
    const igual = comoFue.ok && resolverReintento(previas, [comoFue.fila], new Date()) === "ya-estaba";
    return igual ? { destino } : { estado: "error", errores: { general: yaGuardado }, valores: otraVez };
  }

  const preparado = prepararApartado(entrada, sobres, deudas.id, hoy);
  if (!preparado.ok) return { estado: "error", errores: preparado.errores, valores };
  const fila = { ...preparado.fila, referenciaExterna };
  let registro: Awaited<ReturnType<typeof apartarADeudas>>;
  try {
    registro = await apartarADeudas(valores.idCaptura, fila);
  } catch (error) {
    registrarFalla("No se pudo apartar para deudas", error);
    return { estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
  }
  if ("sinSaldo" in registro) {
    const nombre = sobres.find((s) => s.id === fila.sobreOrigenId)?.nombre ?? "el sobre";
    const monto = `No puede pasar de lo que tiene ${nombre}: ${formatearCifra(registro.saldoCentavos)}`;
    return { estado: "error", errores: { monto }, valores };
  }
  if (!registro.nueva && resolverReintento(registro.guardadas, [fila], new Date()) === "otra") {
    return { estado: "error", errores: { general: yaGuardado }, valores: otraVez };
  }
  return { destino };
}
