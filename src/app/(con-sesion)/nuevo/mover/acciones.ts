"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { saldosPorSobre } from "@/db/consultas";
import { guardadasDeCaptura } from "@/db/movimientos";
import { moverEntreSobres } from "@/db/mover";
import { esIdCaptura, referenciaDeMover, resolverReintento } from "@/lib/captura";
import { formatearCifra } from "@/lib/dinero";
import { mensajeDeFalla } from "@/lib/fallas";
import { hoyEnCaracas } from "@/lib/fechas";
import { confirmacionDeInversion, prepararMover } from "@/lib/mover";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type ErroresFormularioMover, type EstadoMover, type ValoresMover, tecleadoDe } from "./valores";

const esquema = z.object({
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  origenId: z.string().regex(/^\d{0,9}$/, "Elige de dónde mover"),
  destinoId: z.string().regex(/^\d{0,9}$/, "Elige a dónde mover"),
  monto: z.string().trim().max(30, "Ese número es demasiado largo"),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
});

const queNoSeGuardo = "no se movió nada";
const yaGuardado = "Esto ya se movió antes: revísalo en Movimientos y, si es otro, vuelve a guardar.";

function revalidar() {
  for (const ruta of ["/", "/sobres", "/movimientos", "/cuentas", "/deudas", "/sobres/repartir", "/nuevo/ingreso"]) {
    revalidatePath(ruta);
  }
  revalidatePath("/sobres/[id]", "page");
}

/** Mover entre sobres (spec 007, criterios 7 a 9). Con la sesión vencida no redirige. Al guardar, vuelve a /sobres. */
export async function moverAccion(previo: EstadoMover, datos: FormData): Promise<EstadoMover> {
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
  | { destino: string }
  | { estado: "error"; errores: ErroresFormularioMover; valores: ValoresMover }
  | { estado: "confirmar"; valores: ValoresMover };

async function procesar(datos: FormData): Promise<Resultado> {
  const leido = esquema.safeParse(tecleadoDe(datos));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const valores: ValoresMover = leido.data;
  const sobres = await saldosPorSobre();
  const hoy = hoyEnCaracas(new Date());
  const entrada = {
    monto: valores.monto,
    origenId: valores.origenId ? Number(valores.origenId) : null,
    destinoId: valores.destinoId ? Number(valores.destinoId) : null,
    nota: valores.nota,
    // La confirmación lleva el origen y el monto del aviso: si se cambió uno de los dos, se vuelve a pedir.
    confirmaInversion: datos.get("confirmarInversion") === confirmacionDeInversion(valores.origenId, valores.monto),
  };
  const destino = "/sobres?movido=1";
  const otraVez = { ...valores, idCaptura: crypto.randomUUID() };

  // El reintento se reconoce antes de mirar el saldo: si el primero vació el origen, ya no alcanzaría.
  const previas = await guardadasDeCaptura(valores.idCaptura);
  if (previas.length > 0) {
    const sinTope = sobres.map((s) => ({ ...s, saldoCentavos: Number.MAX_SAFE_INTEGER }));
    const comoFue = prepararMover({ ...entrada, confirmaInversion: true }, sinTope, hoy);
    const igual = comoFue.estado === "ok" && resolverReintento(previas, [comoFue.fila], new Date()) === "ya-estaba";
    return igual ? { destino } : { estado: "error", errores: { general: yaGuardado }, valores: otraVez };
  }

  const preparado = prepararMover(entrada, sobres, hoy);
  if (preparado.estado === "error") return { estado: "error", errores: preparado.errores, valores };
  if (preparado.estado === "confirmar") return { estado: "confirmar", valores };
  const fila = {
    ...preparado.fila,
    // Con la marca de Mover: el reparto no lo cuenta como recibido de Por asignar (criterio 10).
    referenciaExterna: referenciaDeMover(valores.idCaptura, preparado.fila.sobreDestinoId),
  };
  let registro: Awaited<ReturnType<typeof moverEntreSobres>>;
  try {
    registro = await moverEntreSobres(valores.idCaptura, fila);
  } catch (error) {
    registrarFalla("No se pudo mover entre sobres", error);
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
