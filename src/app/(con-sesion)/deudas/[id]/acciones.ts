"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaPagar } from "@/db/consultas";
import { deudaPorId } from "@/db/deudas";
import { cobrarPrestamo, pagarDeuda } from "@/db/guardar-deudas";
import { guardadasDeCaptura } from "@/db/movimientos";
import { sobrePorAsignar } from "@/db/reparto";
import { esIdCaptura, referenciaDeCaptura, resolverReintento } from "@/lib/captura";
import { type DeudaParaSaldar, type EntradaPago, prepararPago } from "@/lib/deudas";
import { formatearCifra } from "@/lib/dinero";
import { mensajeDeFalla } from "@/lib/fallas";
import { fechaDesdeAtajo, hoyEnCaracas } from "@/lib/fechas";
import { prepararCobro } from "@/lib/prestamos";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type ErroresFormularioPago, type EstadoPago, type ValoresPago, tecleadoDe } from "./valores";

const esquema = z.object({
  deudaId: z.string().regex(/^\d{1,9}$/, "Esa deuda no existe"),
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  monto: z.string().trim().max(30, "Ese número es demasiado largo"),
  cuentaId: z.string().regex(/^\d{0,9}$/, "Elige una cuenta en dólares"),
  sobreId: z.string().regex(/^\d{0,9}$/, "Elige de qué sobre sale"),
  categoriaId: z.string().regex(/^\d{0,9}$/, "Elige una categoría de gasto"),
  fecha: z.string().trim().max(10, "Elige hoy o un día anterior"),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
});

/** Lo que distingue pagar de cobrar en la pantalla: el sobre que hace falta y cómo se dice. */
const textos = {
  pago: {
    queNoSeGuardo: "el pago no se guardó",
    yaGuardado: "Este pago ya se guardó antes: revísalo en el historial y, si es otro, vuelve a guardar.",
    sinSobre: "Elige de qué sobre sale el pago",
    saldada: "Esta deuda ya está pagada",
  },
  cobro: {
    queNoSeGuardo: "el cobro no se guardó",
    yaGuardado: "Este cobro ya se guardó antes: revísalo en el historial y, si es otro, vuelve a guardar.",
    sinSobre: "No hay un sobre Por asignar activo: no se puede cobrar",
    saldada: "Ya está cobrado",
  },
} as const;

type Cual = keyof typeof textos;

/** Lo que cambia con un pago o un cobro: la deuda, los sobres, la cuenta, la cuota y el patrimonio. */
function revalidar() {
  const rutas = [
    "/deudas",
    "/",
    "/cuentas",
    "/sobres",
    "/movimientos",
    "/nuevo/ingreso",
    "/nuevo/deuda",
    "/sobres/repartir",
  ];
  for (const ruta of rutas) {
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
    const general = mensajeDeFalla("sesion", textos.pago.queNoSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  return terminar(previo, await procesar(datos, "pago"));
}

/** Registra un cobro de algo que me deben (criterios 5, 6 y 7): entra a la cuenta y a "Por asignar". */
export async function cobrarPrestamoAccion(previo: EstadoPago, datos: FormData): Promise<EstadoPago> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", textos.cobro.queNoSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  return terminar(previo, await procesar(datos, "cobro"));
}

type Resultado = { destino: string } | { estado: "error"; errores: ErroresFormularioPago; valores: ValoresPago };

function terminar(previo: EstadoPago, resultado: Resultado): EstadoPago {
  if ("destino" in resultado) {
    revalidar();
    redirect(resultado.destino);
  }
  return { ronda: (previo?.ronda ?? 0) + 1, ...resultado };
}

/** La fila del pago o del cobro, o el error de cada campo. */
function preparar(cual: Cual, entrada: EntradaPago, deuda: DeudaParaSaldar, sobreId: number, hoy: string) {
  return cual === "pago" ? prepararPago(entrada, deuda, sobreId, hoy) : prepararCobro(entrada, deuda, sobreId, hoy);
}

/** El sobre del pago, entre los que lo aceptan (spec 014); el del cobro, Por asignar. Null si no vale. */
async function sobreElegido(cual: Cual, sobreId: string) {
  if (cual === "cobro") return sobrePorAsignar();
  const sobre = (await sobresParaPagar()).find((s) => String(s.id) === sobreId);
  return sobre ? { id: sobre.id, activo: true } : null;
}

/** La categoría si el pago también es gasto: null si no lo es, undefined si la elegida no es de gasto activa. */
async function categoriaElegida(cual: Cual, categoriaId: string): Promise<number | null | undefined> {
  if (cual === "cobro" || categoriaId === "") return null;
  return (await categoriasDeGastoPorUso()).find((c) => String(c.id) === categoriaId)?.id;
}

/** La deuda, el sobre, la categoría y la cuenta se leen de la base: nada del formulario se cree a ciegas. */
async function procesar(datos: FormData, cual: Cual): Promise<Resultado> {
  const t = textos[cual];
  const leido = esquema.safeParse(tecleadoDe(datos));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const valores: ValoresPago = leido.data;
  const deudaId = Number(valores.deudaId);
  const hoy = hoyEnCaracas(new Date());
  const [deuda, sobre, cuentas, categoriaId] = await Promise.all([
    deudaPorId(deudaId),
    sobreElegido(cual, valores.sobreId),
    saldosPorCuenta(),
    categoriaElegida(cual, valores.categoriaId),
  ]);
  if (!deuda) return { estado: "error", errores: { general: "Esa deuda ya no existe" }, valores };
  if (!sobre?.activo) {
    return { estado: "error", errores: cual === "pago" ? { sobre: t.sinSobre } : { general: t.sinSobre }, valores };
  }
  if (categoriaId === undefined) {
    return { estado: "error", errores: { categoria: "Elige una categoría de gasto, o «No»" }, valores };
  }
  const cuenta = cuentas.find((c) => String(c.id) === valores.cuentaId);
  const entrada: EntradaPago = {
    monto: valores.monto,
    fecha: fechaDesdeAtajo(valores.fecha, hoy),
    nota: valores.nota,
    cuenta: cuenta ? { id: cuenta.id, moneda: cuenta.moneda } : null,
    categoriaId,
  };
  const referenciaExterna = referenciaDeCaptura(valores.idCaptura, cual);
  const destino = `/deudas/${deudaId}?guardado=${cual}`;
  const otraVez = { ...valores, idCaptura: crypto.randomUUID() };

  // El reintento se reconoce antes de preparar: si el primer intento saldó la deuda, preparar diría "ya está pagada"
  // de algo que sí se guardó (guardian-datos, T7). Para comparar, la fila sin el tope del pendiente.
  const previas = await guardadasDeCaptura(valores.idCaptura);
  if (previas.length > 0) {
    const comoFue = preparar(cual, entrada, { ...deuda, pendienteCentavos: Number.MAX_SAFE_INTEGER }, sobre.id, hoy);
    const igual = comoFue.ok && resolverReintento(previas, [comoFue.fila], new Date()) === "ya-estaba";
    return igual ? { destino } : { estado: "error", errores: { general: t.yaGuardado }, valores: otraVez };
  }

  const preparado = preparar(cual, entrada, deuda, sobre.id, hoy);
  if (!preparado.ok) return { estado: "error", errores: preparado.errores, valores };
  const fila = { ...preparado.fila, referenciaExterna };
  let registro: Awaited<ReturnType<typeof pagarDeuda>>;
  try {
    registro =
      cual === "pago" ? await pagarDeuda(valores.idCaptura, fila) : await cobrarPrestamo(valores.idCaptura, fila);
  } catch (error) {
    registrarFalla(cual === "pago" ? "No se pudo registrar el pago" : "No se pudo registrar el cobro", error);
    return { estado: "error", errores: { general: mensajeDeFalla("otra", t.queNoSeGuardo) }, valores };
  }
  if ("noExiste" in registro) return { estado: "error", errores: { general: "Esa deuda ya no existe" }, valores };
  if ("excede" in registro) {
    const monto =
      registro.pendienteCentavos > 0
        ? `No puede pasar de lo pendiente: ${formatearCifra(registro.pendienteCentavos)}`
        : t.saldada;
    return { estado: "error", errores: { monto }, valores };
  }
  if (!registro.nueva && resolverReintento(registro.guardadas, [fila], new Date()) === "otra") {
    return { estado: "error", errores: { general: t.yaGuardado }, valores: otraVez };
  }
  return { destino };
}
