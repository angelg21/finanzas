"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaGasto } from "@/db/consultas";
import { borrarIngreso } from "@/db/borrar-ingreso";
import { borrarGasto, editarGasto, editarIngreso, movimientoParaEditar } from "@/db/editar-movimientos";
import { deshacerPagoOCobro } from "@/db/deshacer-pago";
import { deshacerTransferencia } from "@/db/transferencias";
import { categoriasDeIngresoPorUso } from "@/db/reparto";
import { planDeEdicionDeGasto } from "@/lib/editar-gasto";
import { planDeEdicionDeIngreso } from "@/lib/editar-ingreso";
import { mensajeDeFalla } from "@/lib/fallas";
import { fechaDesdeAtajo, hoyEnCaracas } from "@/lib/fechas";
import { type FormaPago, prepararGasto } from "@/lib/gastos";
import { registrarFalla } from "@/app/registro-de-fallas";
import { leerSesion } from "@/app/sesion";
import { etiquetaDelFormulario } from "../../etiqueta-del-formulario";
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
    etiquetaId: texto(datos, "etiquetaId"),
    etiquetaNueva: texto(datos, "etiquetaNueva"),
  };
}

function revalidar() {
  for (const ruta of ["/", "/movimientos", "/sobres", "/cuentas", "/deudas"]) revalidatePath(ruta);
  revalidatePath("/sobres/[id]", "page");
  revalidatePath("/movimientos/[id]", "page");
  revalidatePath("/deudas/[id]", "page");
}

/**
 * La categoría elegida entre las activas, o la que el movimiento ya tiene aunque esté archivada: corregir el monto o
 * la nota no obliga a recategorizar (revisión de la 006, hallazgo 3). Solo en ese caso se lee el movimiento.
 */
async function categoriaElegida(activas: { id: number }[], elegida: string, id: number, tipo: "gasto" | "ingreso") {
  const activa = activas.find((c) => String(c.id) === elegida);
  if (activa) return activa.id;
  const actual = await movimientoParaEditar(id);
  const suya = actual?.movimiento.tipo === tipo ? actual.movimiento.categoriaId : null;
  return suya !== null && String(suya) === elegida ? suya : null;
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
  const categoriaId = await categoriaElegida(categorias, valores.categoriaId, id, "gasto");
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
    categoriaId: categoriaId ?? 0,
  };
  const preparado = prepararGasto(entrada, hoy);
  const errores: ErroresFormularioGasto = preparado.ok ? {} : { ...preparado.errores };
  if (categoriaId === null) errores.categoria = "Elige una categoría";
  if (!sobre) errores.sobre = "Elige un sobre";
  if (!preparado.ok || categoriaId === null || !sobre) return { ronda, estado: "error", errores, valores };
  if (sobre.tipo === "inversion" && texto(datos, "confirmarSobre") !== String(sobre.id)) {
    return { ronda, estado: "confirmar", valores };
  }
  // La etiqueta pedida, sin escribir: la transacción la crea solo si la edición se guarda (spec 008).
  const etiqueta = await etiquetaDelFormulario(datos);
  if (!etiqueta.ok) return { ronda, estado: "error", errores: { etiqueta: etiqueta.error }, valores };

  let resultado: Awaited<ReturnType<typeof editarGasto>>;
  try {
    resultado = await editarGasto(id, (guardado) => planDeEdicionDeGasto(guardado, entrada, hoy), etiqueta.etiqueta);
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
    etiquetaId: texto(datos, "etiquetaId"),
    etiquetaNueva: texto(datos, "etiquetaNueva"),
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
  const categoriaId = await categoriaElegida(categorias, valores.categoriaId, id, "ingreso");
  const cuenta = cuentas.find((c) => String(c.id) === valores.cuentaId && c.moneda !== "VES") ?? null;
  if (categoriaId === null) return { ronda, estado: "error", errores: { categoria: "Elige una categoría" }, valores };
  const hoy = hoyEnCaracas(new Date());
  const nueva = { ...valores, fecha: fechaDesdeAtajo(valores.fecha, hoy), categoriaId };
  // La etiqueta pedida, sin escribir: la transacción la crea solo si la edición se guarda (spec 008).
  const etiqueta = await etiquetaDelFormulario(datos);
  if (!etiqueta.ok) return { ronda, estado: "error", errores: { etiqueta: etiqueta.error }, valores };

  let resultado: Awaited<ReturnType<typeof editarIngreso>>;
  try {
    resultado = await editarIngreso(
      id,
      (guardado, saldo) =>
        planDeEdicionDeIngreso(guardado, nueva, cuenta && { id: cuenta.id, moneda: cuenta.moneda }, saldo, hoy),
      etiqueta.etiqueta,
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

/**
 * Criterios 6, 7, 9 y 10: el gasto con su venta, o el ingreso con su reparto. Un cobro o un ingreso ya repartidos se
 * aplican con la firma de la vista previa que se confirmó (spec 007, criterio 11): si algo cambió desde entonces, no
 * se aplica y la página vuelve con la vista previa de ahora.
 */
export async function borrarMovimientoAccion(_previo: EstadoBorrar, datos: FormData): Promise<EstadoBorrar> {
  const sesion = await leerSesion();
  if (!sesion) return { error: mensajeDeFalla("sesion", "no se borró") };
  const id = idDe(datos);
  if (id === null) redirect("/movimientos");
  const tipo = texto(datos, "tipo");
  const deshacer = tipo === "pago" || tipo === "cobro" || tipo === "transferencia";
  const firma = texto(datos, "firma");
  let resultado:
    | Awaited<ReturnType<typeof borrarGasto>>
    | Awaited<ReturnType<typeof borrarIngreso>>
    | Awaited<ReturnType<typeof deshacerPagoOCobro>>
    | Awaited<ReturnType<typeof deshacerTransferencia>>;
  try {
    // Spec 007: un pago o un cobro se deshace; spec 011: una transferencia entre cuentas, con su comisión; un gasto o
    // un ingreso se borra con lo enlazado (spec 006).
    resultado =
      tipo === "transferencia"
        ? await deshacerTransferencia(id)
        : deshacer
          ? await deshacerPagoOCobro(id, firma)
          : tipo === "ingreso"
            ? await borrarIngreso(id, firma)
            : await borrarGasto(id);
  } catch (error) {
    registrarFalla("No se pudo borrar el movimiento", error);
    return { error: mensajeDeFalla("otra", "no se borró") };
  }
  if ("noExiste" in resultado) redirect(conAviso("/movimientos", "borrado=ya"));
  if ("cambio" in resultado) {
    revalidar();
    return { error: "Algo cambió desde la vista previa. Mira cómo queda ahora y confirma otra vez." };
  }
  if (!resultado.ok) return { error: resultado.error };
  revalidar();
  redirect(conAviso(destinoDeVuelta(texto(datos, "volver")), deshacer ? "borrado=deshecho" : "borrado=1"));
}
