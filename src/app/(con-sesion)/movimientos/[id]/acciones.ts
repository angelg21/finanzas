"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaGasto } from "@/db/consultas";
import { borrarGasto, borrarIngreso, editarGasto, editarIngreso } from "@/db/editar-movimientos";
import { deshacerPagoOCobro } from "@/db/guardar-deudas";
import { categoriasDeIngresoPorUso } from "@/db/reparto";
import { planDeEdicionDeGasto } from "@/lib/editar-gasto";
import { planDeEdicionDeIngreso } from "@/lib/editar-ingreso";
import { mensajeDeFalla } from "@/lib/fallas";
import { fechaDesdeAtajo, hoyEnCaracas } from "@/lib/fechas";
import { type FormaPago, prepararGasto } from "@/lib/gastos";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import type { ErroresFormularioGasto, ValoresGasto } from "../../nuevo/gasto/acciones";
import {
  type EstadoBorrar,
  type EstadoEdicionGasto,
  type EstadoEdicionIngreso,
  type ValoresIngresoEditado,
  conAviso,
  destinoDeVuelta,
} from "./valores";

/*
  Editar o borrar un gasto o un ingreso (spec 006). Como en la captura, nada del formulario se cree a ciegas: la
  categoría, el sobre y las cuentas se buscan entre los activos y aptos, y la moneda sale de la cuenta. La escritura
  va en src/db/editar-movimientos.ts, que pide el plan con lo leído dentro de su transacción.
*/

const noSeGuardo = "no se guardó";
const formas = ["dolares", "vendiendo", "saldo"] as const;

function texto(datos: FormData, nombre: string) {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

function idDe(datos: FormData) {
  const id = Number(texto(datos, "id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Lo tecleado del gasto, con los mismos campos que la captura; el id de captura no se usa al editar. */
function tecleadoDe(datos: FormData): ValoresGasto {
  const forma = texto(datos, "forma");
  return {
    forma: (formas as readonly string[]).includes(forma) ? (forma as FormaPago) : "dolares",
    monto: texto(datos, "monto"),
    tasa: texto(datos, "tasa"),
    vendido: texto(datos, "vendido"),
    cuentaId: texto(datos, "cuentaId"),
    cuentaVentaId: texto(datos, "cuentaVentaId"),
    categoriaId: texto(datos, "categoriaId"),
    sobreId: texto(datos, "sobreId"),
    fecha: texto(datos, "fecha"),
    nota: texto(datos, "nota"),
    idCaptura: texto(datos, "idCaptura"),
  };
}

function revalidar() {
  for (const ruta of ["/", "/movimientos", "/sobres", "/cuentas", "/deudas"]) revalidatePath(ruta);
  revalidatePath("/sobres/[id]", "page");
  revalidatePath("/movimientos/[id]", "page");
  revalidatePath("/deudas/[id]", "page");
}

const nota = z.string().trim().max(200, "La nota admite hasta 200 caracteres");
const cifra = z.string().trim().max(30, "Ese número es demasiado largo");

/** Criterios 2, 3, 9 y 10. Con la sesión vencida responde con el mensaje y lo tecleado, sin perder la pantalla. */
export async function editarGastoAccion(previo: EstadoEdicionGasto, datos: FormData): Promise<EstadoEdicionGasto> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", noSeGuardo);
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(datos) };
  }
  const ronda = (previo?.ronda ?? 0) + 1;
  const valores = tecleadoDe(datos);
  const id = idDe(datos);
  if (id === null) redirect("/movimientos");
  const leidos = z.object({ monto: cifra, tasa: cifra, vendido: cifra, nota }).safeParse(valores);
  if (!leidos.success) {
    const general = leidos.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { ronda, estado: "error", errores: { general }, valores };
  }

  const [categorias, sobres, cuentas] = await Promise.all([
    categoriasDeGastoPorUso(),
    sobresParaGasto(),
    saldosPorCuenta(),
  ]);
  const categoria = categorias.find((c) => String(c.id) === valores.categoriaId);
  const sobre = sobres.find((s) => String(s.id) === valores.sobreId);
  const elegida = valores.forma === "vendiendo" ? valores.cuentaVentaId : valores.cuentaId;
  const cuentaOrigen = cuentas.find((c) => String(c.id) === elegida && c.moneda !== "VES");
  const bolivares = cuentas.find((c) => c.moneda === "VES") ?? null;
  const hoy = hoyEnCaracas(new Date());
  const entrada = {
    ...valores,
    fecha: fechaDesdeAtajo(valores.fecha, hoy),
    cuentaOrigen: cuentaOrigen ?? { id: 0, moneda: "VES" as const },
    cuentaBolivares: bolivares,
    sobreId: sobre?.id ?? 0,
    categoriaId: categoria?.id ?? 0,
  };
  const preparado = prepararGasto(entrada, hoy);
  const errores: ErroresFormularioGasto = preparado.ok ? {} : { ...preparado.errores };
  if (!categoria) errores.categoria = "Elige una categoría";
  if (!sobre) errores.sobre = "Elige un sobre";
  if (!preparado.ok || !categoria || !sobre) return { ronda, estado: "error", errores, valores };
  if (sobre.tipo === "inversion" && texto(datos, "confirmarSobre") !== String(sobre.id)) {
    return { ronda, estado: "confirmar", valores };
  }

  let resultado: Awaited<ReturnType<typeof editarGasto>>;
  try {
    resultado = await editarGasto(id, (guardado) => planDeEdicionDeGasto(guardado, entrada, hoy));
  } catch (error) {
    registrarFalla("No se pudo editar el gasto", error);
    return { ronda, estado: "error", errores: { general: mensajeDeFalla("otra") }, valores };
  }
  if ("noExiste" in resultado) redirect(conAviso("/movimientos", "borrado=ya"));
  if (!resultado.ok) return { ronda, estado: "error", errores: resultado.errores, valores };
  revalidar();
  redirect(conAviso(destinoDeVuelta(texto(datos, "volver")), "editado=gasto"));
}

function valoresDe(datos: FormData): ValoresIngresoEditado {
  return {
    monto: texto(datos, "monto"),
    cuentaId: texto(datos, "cuentaId"),
    categoriaId: texto(datos, "categoriaId"),
    fecha: texto(datos, "fecha"),
    nota: texto(datos, "nota"),
  };
}

/** Criterios 4, 5, 9 y 10. */
export async function editarIngresoAccion(
  previo: EstadoEdicionIngreso,
  datos: FormData,
): Promise<EstadoEdicionIngreso> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion", noSeGuardo);
    return {
      ronda: (previo?.ronda ?? 0) + 1,
      estado: "error",
      errores: { general },
      valores: valoresDe(datos),
    };
  }
  const ronda = (previo?.ronda ?? 0) + 1;
  const valores = valoresDe(datos);
  const id = idDe(datos);
  if (id === null) redirect("/movimientos");
  const leidos = z.object({ monto: cifra, nota }).safeParse(valores);
  if (!leidos.success) {
    const general = leidos.error.issues[0]?.message ?? "Revisa los datos del formulario";
    return { ronda, estado: "error", errores: { general }, valores };
  }

  const [categorias, cuentas] = await Promise.all([categoriasDeIngresoPorUso(), saldosPorCuenta()]);
  const categoria = categorias.find((c) => String(c.id) === valores.categoriaId);
  const cuenta = cuentas.find((c) => String(c.id) === valores.cuentaId && c.moneda !== "VES") ?? null;
  if (!categoria) return { ronda, estado: "error", errores: { categoria: "Elige una categoría" }, valores };
  const hoy = hoyEnCaracas(new Date());
  const nueva = { ...valores, fecha: fechaDesdeAtajo(valores.fecha, hoy), categoriaId: categoria.id };

  let resultado: Awaited<ReturnType<typeof editarIngreso>>;
  try {
    resultado = await editarIngreso(id, (guardado, saldo) =>
      planDeEdicionDeIngreso(guardado, nueva, cuenta && { id: cuenta.id, moneda: cuenta.moneda }, saldo, hoy),
    );
  } catch (error) {
    registrarFalla("No se pudo editar el ingreso", error);
    return { ronda, estado: "error", errores: { general: mensajeDeFalla("otra") }, valores };
  }
  if ("noExiste" in resultado) redirect(conAviso("/movimientos", "borrado=ya"));
  if (!resultado.ok) {
    const { monto, cuenta: errorCuenta, fecha, reparto } = resultado.errores;
    return { ronda, estado: "error", errores: { monto, cuenta: errorCuenta, fecha, general: reparto }, valores };
  }
  revalidar();
  redirect(conAviso(destinoDeVuelta(texto(datos, "volver")), "editado=ingreso"));
}

/** Criterios 6, 7, 9 y 10: el gasto con su venta, o el ingreso con su reparto. */
export async function borrarMovimientoAccion(_previo: EstadoBorrar, datos: FormData): Promise<EstadoBorrar> {
  const sesion = await leerSesion();
  if (!sesion) return { error: mensajeDeFalla("sesion", "no se borró") };
  const id = idDe(datos);
  if (id === null) redirect("/movimientos");
  const tipo = texto(datos, "tipo");
  const deshacer = tipo === "pago" || tipo === "cobro";
  let resultado:
    | Awaited<ReturnType<typeof borrarGasto>>
    | Awaited<ReturnType<typeof borrarIngreso>>
    | Awaited<ReturnType<typeof deshacerPagoOCobro>>;
  try {
    // Spec 007: un pago o un cobro se deshace; un gasto o un ingreso se borra con lo enlazado (spec 006).
    resultado = deshacer
      ? await deshacerPagoOCobro(id)
      : tipo === "ingreso"
        ? await borrarIngreso(id)
        : await borrarGasto(id);
  } catch (error) {
    registrarFalla("No se pudo borrar el movimiento", error);
    return { error: mensajeDeFalla("otra", "no se borró") };
  }
  if ("noExiste" in resultado) redirect(conAviso("/movimientos", "borrado=ya"));
  if (!resultado.ok) return { error: resultado.error };
  revalidar();
  redirect(conAviso(destinoDeVuelta(texto(datos, "volver")), deshacer ? "borrado=deshecho" : "borrado=1"));
}
