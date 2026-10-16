"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { saldosPorCuenta } from "@/db/consultas";
import { deudaPorId, sobreDeudas } from "@/db/deudas";
import { pagarDeuda } from "@/db/guardar-deudas";
import { guardadasDeCaptura } from "@/db/movimientos";
import { esIdCaptura, referenciaDeCaptura, resolverReintento } from "@/lib/captura";
import { type EntradaPago, prepararPago } from "@/lib/deudas";
import { formatearCifra } from "@/lib/dinero";
import { mensajeDeFalla } from "@/lib/fallas";
import { fechaDesdeAtajo, hoyEnCaracas } from "@/lib/fechas";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type ErroresFormularioPago, type EstadoPago, type ValoresPago, tecleadoDe } from "./valores";

const esquema = z.object({
  deudaId: z.string().regex(/^\d{1,9}$/, "Esa deuda no existe"),
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  monto: z.string().trim().max(30, "Ese número es demasiado largo"),
  cuentaId: z.string().regex(/^\d{0,9}$/, "Elige una cuenta en dólares"),
  fecha: z.string().trim().max(10, "Elige hoy o un día anterior"),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
});

const queNoSeGuardo = "el pago no se guardó";
const yaGuardado = "Este pago ya se guardó antes: revísalo en el historial y, si es otro, vuelve a guardar.";

/** Lo que cambia con un pago: la deuda, Deudas, la cuenta, la cuota y el patrimonio. */
function revalidar() {
  for (const ruta of ["/deudas", "/", "/cuentas", "/sobres", "/movimientos", "/nuevo/ingreso", "/sobres/repartir"]) {
    revalidatePath(ruta);
  }
  revalidatePath("/deudas/[id]", "page");
  revalidatePath("/sobres/[id]", "page");
}

/**
 * Registra un pago de una deuda que debo (spec 005, criterios 3, 6 y 7). Para `useActionState`. Con la sesión vencida
 * no redirige: responde con el mensaje y lo tecleado. Al guardar, vuelve al detalle de la deuda.
 */
export async function pagarDeudaAccion(previo: EstadoPago, datos: FormData): Promise<EstadoPago> {
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

type Resultado = { destino: string } | { estado: "error"; errores: ErroresFormularioPago; valores: ValoresPago };

/** La deuda, Deudas y la cuenta se leen de la base: nada del formulario se cree a ciegas. */
async function procesar(datos: FormData): Promise<Resultado> {
  const leido = esquema.safeParse(tecleadoDe(datos));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const valores: ValoresPago = leido.data;
  const deudaId = Number(valores.deudaId);
  const hoy = hoyEnCaracas(new Date());
  const [deuda, sobre, cuentas] = await Promise.all([deudaPorId(deudaId), sobreDeudas(), saldosPorCuenta()]);
  if (!deuda) return { estado: "error", errores: { general: "Esa deuda ya no existe" }, valores };
  if (!sobre?.activo) {
    return { estado: "error", errores: { general: "No hay un sobre Deudas activo: no se puede pagar" }, valores };
  }
  const cuenta = cuentas.find((c) => String(c.id) === valores.cuentaId);
  const entrada: EntradaPago = {
    monto: valores.monto,
    fecha: fechaDesdeAtajo(valores.fecha, hoy),
    nota: valores.nota,
    cuenta: cuenta ? { id: cuenta.id, moneda: cuenta.moneda } : null,
  };
  const referenciaExterna = referenciaDeCaptura(valores.idCaptura, "pago");
  const destino = `/deudas/${deudaId}?guardado=pago`;
  const otraVez = { ...valores, idCaptura: crypto.randomUUID() };

  // El reintento se reconoce antes de preparar: si el primer intento saldó la deuda, prepararPago diría "ya está
  // pagada" de un pago que sí se guardó (guardian-datos, T7). Para comparar, la fila sin el tope del pendiente.
  const previas = await guardadasDeCaptura(valores.idCaptura);
  if (previas.length > 0) {
    const comoFue = prepararPago(entrada, { ...deuda, pendienteCentavos: Number.MAX_SAFE_INTEGER }, sobre.id, hoy);
    const igual = comoFue.ok && resolverReintento(previas, [comoFue.fila], new Date()) === "ya-estaba";
    return igual ? { destino } : { estado: "error", errores: { general: yaGuardado }, valores: otraVez };
  }

  const preparado = prepararPago(entrada, deuda, sobre.id, hoy);
  if (!preparado.ok) return { estado: "error", errores: preparado.errores, valores };
  const fila = { ...preparado.fila, referenciaExterna };
  let registro: Awaited<ReturnType<typeof pagarDeuda>>;
  try {
    registro = await pagarDeuda(valores.idCaptura, fila);
  } catch (error) {
    registrarFalla("No se pudo registrar el pago", error);
    return { estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
  }
  if ("noExiste" in registro) return { estado: "error", errores: { general: "Esa deuda ya no existe" }, valores };
  if ("excede" in registro) {
    const monto =
      registro.pendienteCentavos > 0
        ? `No puede pasar de lo pendiente: ${formatearCifra(registro.pendienteCentavos)}`
        : "Esta deuda ya está pagada";
    return { estado: "error", errores: { monto }, valores };
  }
  if (!registro.nueva && resolverReintento(registro.guardadas, [fila], new Date()) === "otra") {
    return { estado: "error", errores: { general: yaGuardado }, valores: otraVez };
  }
  return { destino };
}
