"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { saldosPorCuenta, sobresParaGasto } from "@/db/consultas";
import { guardadasDeCaptura } from "@/db/movimientos";
import type { Movimiento } from "@/db/schema";
import { registrarTransferencia } from "@/db/transferencias";
import { esIdCaptura, resolverReintento } from "@/lib/captura";
import { mensajeDeFalla } from "@/lib/fallas";
import { hoyEnCaracas } from "@/lib/fechas";
import { type FilaComision, type FilaTransferencia, prepararTransferencia } from "@/lib/transferencias";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type ErroresFormularioTransferir, type EstadoTransferir, type ValoresTransferir, tecleadoDe } from "./valores";

const esquema = z.object({
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  origenId: z.string().regex(/^\d{0,9}$/, "Elige de qué cuenta salió"),
  destinoId: z.string().regex(/^\d{0,9}$/, "Elige a qué cuenta llegó"),
  salio: z.string().trim().max(30, "Ese número es demasiado largo"),
  llego: z.string().trim().max(30, "Ese número es demasiado largo"),
  sobreId: z.string().regex(/^\d{0,9}$/, "Elige de qué sobre sale la comisión"),
  fecha: z.string().trim().max(10, "Elige hoy o un día anterior"),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
});

const queNoSeGuardo = "no se transfirió nada";
const yaGuardado = "Esto ya se transfirió antes: revísalo en Movimientos y, si es otra, vuelve a guardar.";

function revalidar() {
  for (const ruta of ["/", "/cuentas", "/movimientos", "/sobres"]) revalidatePath(ruta);
  revalidatePath("/sobres/[id]", "page");
}

/** Transferir entre cuentas (spec 011). Con la sesión vencida no redirige. Al guardar, vuelve a /cuentas. */
export async function transferirAccion(previo: EstadoTransferir, datos: FormData): Promise<EstadoTransferir> {
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
  { destino: string } | { estado: "error"; errores: ErroresFormularioTransferir; valores: ValoresTransferir };

/** Las filas como quedaron guardadas: la comisión lleva la categoría que puso la base, para comparar un reintento. */
function comoSeGuardan(transferencia: FilaTransferencia, comision: FilaComision | null, guardadas: Movimiento[]) {
  const categoriaId = guardadas.find((g) => g.tipo === "gasto")?.categoriaId ?? null;
  return comision ? [transferencia, { ...comision, categoriaId }] : [transferencia];
}

async function procesar(datos: FormData): Promise<Resultado> {
  const leido = esquema.safeParse(tecleadoDe(datos));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const valores: ValoresTransferir = leido.data;
  const [cuentas, sobres] = await Promise.all([saldosPorCuenta(), sobresParaGasto()]);
  const hoy = hoyEnCaracas(new Date());
  const preparado = prepararTransferencia(
    {
      origenId: valores.origenId ? Number(valores.origenId) : null,
      destinoId: valores.destinoId ? Number(valores.destinoId) : null,
      salio: valores.salio,
      llego: valores.llego,
      sobreId: valores.sobreId ? Number(valores.sobreId) : null,
      fecha: valores.fecha,
      nota: valores.nota,
    },
    cuentas,
    sobres,
    hoy,
  );
  if (!preparado.ok) return { estado: "error", errores: preparado.errores, valores };
  const destino = "/cuentas?transferido=1";
  const otraVez = { ...valores, idCaptura: crypto.randomUUID() };
  const { transferencia, comision } = preparado;

  // Un reintento se reconoce por las referencias de la captura antes de escribir.
  const previas = await guardadasDeCaptura(valores.idCaptura);
  if (previas.length > 0) {
    const igual =
      resolverReintento(previas, comoSeGuardan(transferencia, comision, previas), new Date()) === "ya-estaba";
    return igual ? { destino } : { estado: "error", errores: { general: yaGuardado }, valores: otraVez };
  }

  let registro: Awaited<ReturnType<typeof registrarTransferencia>>;
  try {
    registro = await registrarTransferencia(valores.idCaptura, transferencia, comision);
  } catch (error) {
    registrarFalla("No se pudo transferir entre cuentas", error);
    return { estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
  }
  if (!registro.nueva) {
    const comparables = comoSeGuardan(transferencia, comision, registro.guardadas);
    if (resolverReintento(registro.guardadas, comparables, new Date()) === "otra") {
      return { estado: "error", errores: { general: yaGuardado }, valores: otraVez };
    }
  }
  return { destino };
}
