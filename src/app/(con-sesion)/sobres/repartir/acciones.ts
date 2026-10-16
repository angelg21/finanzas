"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardadasDeCaptura, repartirPorAsignar } from "@/db/movimientos";
import { datosDelReparto } from "@/db/reparto";
import { esIdCaptura, referenciaDeReasignacion, resolverReintento } from "@/lib/captura";
import { formatearCentavos } from "@/lib/dinero";
import { mensajeDeFalla } from "@/lib/fallas";
import { hoyEnCaracas } from "@/lib/fechas";
import { filasDeReparto, validarAsignaciones } from "@/lib/ingresos";
import type { Asignacion } from "@/lib/reparto";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type EstadoRepartir, type ResultadoRepartir, tecleadoDe } from "./valores";

const esquema = z.object({
  // Sin un id válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  asignaciones: z
    .record(z.string(), z.string().trim().max(30, "Ese número es demasiado largo"))
    .refine((a) => Object.keys(a).length <= 50, "Demasiados sobres en el reparto"),
});

const queNoSeGuardo = "el reparto no se guardó";

/**
 * Reparte lo que ya está en "Por asignar" (spec 004, criterio 10): solo reasignaciones, con fecha de hoy. Para
 * `useActionState`. Con la sesión vencida responde con el mensaje y lo tecleado.
 */
export async function repartir(previo: EstadoRepartir, formData: FormData): Promise<EstadoRepartir> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", queNoSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(formData) };
  }
  return { ronda: (previo?.ronda ?? 0) + 1, ...(await procesarReparto(formData)) };
}

/**
 * El saldo y los sobres se leen de la base, nunca del formulario. Esta lectura sirve para avisar pronto; la que
 * manda es la de `repartirPorAsignar`, que vuelve a leer el saldo con candado dentro de la transacción.
 */
async function procesarReparto(formData: FormData): Promise<ResultadoRepartir> {
  const confirmar = formData.get("confirmarSinAsignar");
  const leido = esquema.safeParse(tecleadoDe(formData));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los montos";
    return { estado: "error", errores: { general }, valores: tecleadoDe(formData) };
  }
  const valores = leido.data;

  const reparto = await datosDelReparto();
  const { porAsignar } = reparto;
  if (!porAsignar?.activo) {
    const general = 'No hay un sobre "Por asignar" activo.';
    return { estado: "error", errores: { general }, valores };
  }
  const tecleadas = Object.entries(valores.asignaciones).map(([sobreId, monto]) => ({
    sobreId: Number(sobreId),
    monto,
  }));
  const sobresValidos = reparto.sobres.map((s) => s.id);
  const hoy = hoyEnCaracas(new Date());
  const filasDe = (asignaciones: Asignacion[]) =>
    filasDeReparto(porAsignar.id, asignaciones, hoy).map((f) => ({
      ...f,
      referenciaExterna: referenciaDeReasignacion(valores.idCaptura, f.sobreDestinoId),
    }));
  const nombreDe = new Map(reparto.sobres.map((s) => [s.id, s.nombre]));
  const guardado = (filas: ReturnType<typeof filasDe>, quedanCentavos: number): ResultadoRepartir => {
    for (const ruta of ["/", "/movimientos", "/sobres", "/sobres/repartir", "/nuevo/ingreso"]) revalidatePath(ruta);
    revalidatePath("/sobres/[id]", "page");
    const repartido = filas.map((f) => ({ nombre: nombreDe.get(f.sobreDestinoId) ?? "", centavos: f.montoCentavos }));
    return { estado: "guardado", repartido, quedanCentavos };
  };
  const otraVez: ResultadoRepartir = {
    estado: "error",
    errores: { general: "Este reparto ya se guardó antes: revísalo en Sobres y, si es otro, vuelve a guardar." },
    valores: { ...valores, idCaptura: crypto.randomUUID() },
  };

  // Un reintento se reconoce antes que el saldo (guardian-datos, T5): si el primer intento se llevó todo lo que había,
  // "no queda nada" diría que no se guardó un reparto que sí se guardó.
  const previas = await guardadasDeCaptura(valores.idCaptura);
  if (previas.length > 0) {
    const leidas = validarAsignaciones(Number.MAX_SAFE_INTEGER, tecleadas, sobresValidos);
    const filas = leidas.ok ? filasDe(leidas.asignaciones) : [];
    const mismo = resolverReintento(previas, filas, new Date()) === "ya-estaba";
    return mismo ? guardado(filas, porAsignar.saldoCentavos) : otraVez;
  }

  const saldo = porAsignar.saldoCentavos;
  if (saldo <= 0) {
    return { estado: "error", errores: { general: "No queda nada en Por asignar." }, valores, saldoCentavos: saldo };
  }
  const validas = validarAsignaciones(saldo, tecleadas, sobresValidos);
  if (!validas.ok) return { estado: "error", errores: validas.errores, valores, saldoCentavos: saldo };
  if (validas.asignaciones.every((a) => a.centavos === 0)) {
    return { estado: "error", errores: { reparto: "Escribe cuánto va a cada sobre." }, valores, saldoCentavos: saldo };
  }
  if (validas.sinAsignar > 0 && confirmar !== String(validas.sinAsignar)) {
    return { estado: "confirmar", valores, sinAsignarCentavos: validas.sinAsignar };
  }

  const filas = filasDe(validas.asignaciones);
  let resultado: Awaited<ReturnType<typeof repartirPorAsignar>>;
  try {
    resultado = await repartirPorAsignar(valores.idCaptura, porAsignar.id, filas);
  } catch (error) {
    registrarFalla("No se pudo repartir", error);
    return { estado: "error", errores: { general: "No se pudo guardar. Intenta de nuevo." }, valores };
  }
  if ("sinSaldo" in resultado) {
    // Otra pestaña repartió antes: el candado lo detectó. Se muestra el saldo de ahora para corregir.
    const reparto = `Ya no alcanza: en Por asignar quedan ${formatearCentavos(resultado.saldoCentavos)}.`;
    return { estado: "error", errores: { reparto }, valores, saldoCentavos: resultado.saldoCentavos };
  }
  if (!resultado.nueva && resolverReintento(resultado.guardadas, filas, new Date()) === "otra") return otraVez;
  return guardado(filas, validas.sinAsignar);
}
