"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { saldosPorCuenta, saldosPorSobre } from "@/db/consultas";
import { prestar } from "@/db/guardar-deudas";
import { esIdCaptura, referenciaDeCaptura, resolverReintento, resolverReintentoDeDeuda } from "@/lib/captura";
import { formatearCifra } from "@/lib/dinero";
import { mensajeDeFalla } from "@/lib/fallas";
import { hoyEnCaracas } from "@/lib/fechas";
import { prepararPrestamo } from "@/lib/prestamos";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { type ErroresFormularioPrestamo, type EstadoPrestamo, type ValoresPrestamo, tecleadoDe } from "./valores";

const esquema = z.object({
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
  persona: z.string().max(200, "Usa hasta 80 caracteres"),
  monto: z.string().trim().max(30, "Ese número es demasiado largo"),
  cuentaId: z.string().regex(/^\d{0,9}$/, "Elige una cuenta en dólares"),
  sobreOrigenId: z.string().regex(/^\d{0,9}$/, "Elige de qué sobre sale"),
  fecha: z.string().trim().max(10, "Elige hoy o un día anterior"),
  fechaPrevista: z.string().trim().max(10, "Elige una fecha válida"),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
});

const queNoSeGuardo = "el préstamo no se guardó";
const yaGuardado = "Este préstamo ya se guardó antes: revísalo en Deudas y, si es otro, vuelve a guardar.";

/** Lo que cambia al prestar: la cuenta, el sobre, lo que me deben y el patrimonio. */
function revalidar() {
  for (const ruta of ["/deudas", "/", "/cuentas", "/sobres", "/movimientos", "/nuevo/ingreso", "/sobres/repartir"]) {
    revalidatePath(ruta);
  }
  revalidatePath("/sobres/[id]", "page");
}

/**
 * Presta dinero a otro (spec 005, criterio 4): la deuda "me deben" y el movimiento, juntos o ninguno. Para
 * `useActionState`. Con la sesión vencida no redirige. Al guardar, va al detalle de lo que me deben.
 */
export async function prestarAccion(previo: EstadoPrestamo, datos: FormData): Promise<EstadoPrestamo> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", queNoSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const resultado = await procesar(datos);
  if ("destino" in resultado) {
    revalidar();
    redirect(resultado.destino);
  }
  return { ronda: (previo?.ronda ?? 0) + 1, ...resultado };
}

type Resultado =
  { destino: string } | { estado: "error"; errores: ErroresFormularioPrestamo; valores: ValoresPrestamo };

/** La cuenta y el sobre se leen de la base entre los activos: nada del formulario se cree a ciegas. */
async function procesar(datos: FormData): Promise<Resultado> {
  const leido = esquema.safeParse(tecleadoDe(datos));
  if (!leido.success) {
    const general = leido.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const valores: ValoresPrestamo = leido.data;
  const hoy = hoyEnCaracas(new Date());
  const [cuentas, sobres] = await Promise.all([saldosPorCuenta(), saldosPorSobre()]);
  const cuenta = cuentas.find((c) => String(c.id) === valores.cuentaId);
  const preparado = prepararPrestamo(
    {
      ...valores,
      cuenta: cuenta ? { id: cuenta.id, moneda: cuenta.moneda } : null,
      sobreOrigenId: valores.sobreOrigenId ? Number(valores.sobreOrigenId) : null,
    },
    sobres,
    hoy,
  );
  if (!preparado.ok) return { estado: "error", errores: preparado.errores, valores };
  const fila = { ...preparado.fila, referenciaExterna: referenciaDeCaptura(valores.idCaptura, "prestamo") };

  let registro: Awaited<ReturnType<typeof prestar>>;
  try {
    registro = await prestar(valores.idCaptura, preparado.deuda, fila);
  } catch (error) {
    registrarFalla("No se pudo registrar el préstamo", error);
    return { estado: "error", errores: { general: mensajeDeFalla("otra", queNoSeGuardo) }, valores };
  }
  if ("sinSaldo" in registro) {
    const monto = `No puede pasar de lo que tiene Por asignar: ${formatearCifra(registro.saldoCentavos)}`;
    return { estado: "error", errores: { monto }, valores };
  }
  if (registro.nueva) return { destino: `/deudas/${registro.deudaId}?guardado=prestamo` };
  // Ya había algo con este id: solo es "ya estaba" si la deuda y el movimiento son los mismos y recientes.
  const { deuda, guardadas } = registro;
  const igual =
    deuda !== null &&
    resolverReintentoDeDeuda(deuda, preparado.deuda, new Date()) === "ya-estaba" &&
    resolverReintento(guardadas, [{ ...fila, deudaId: deuda.id }], new Date()) === "ya-estaba";
  if (igual) return { destino: `/deudas/${deuda.id}?guardado=prestamo` };
  return {
    estado: "error",
    errores: { general: yaGuardado },
    valores: { ...valores, idCaptura: crypto.randomUUID() },
  };
}
