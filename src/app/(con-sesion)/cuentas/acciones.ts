"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  actualizarCuenta,
  cuentaPorId,
  cuentasConUso,
  crearCuenta,
  eliminarCuenta,
  restaurarCuenta,
} from "@/db/cuentas";
import { type ErroresCuenta, validarCuenta } from "@/lib/cuentas";
import { leerSesion } from "@/app/sesion";
import { mensajeDeFalla } from "@/lib/fallas";
import { registrarFalla } from "@/app/registro-de-fallas";

/** Lo tecleado, para volver a llenar el formulario si hay que corregir. */
export type ValoresFormularioCuenta = { nombre: string; moneda: string; tipo: string; icono: string; color: string };

export type EstadoCuenta = { ronda: number } & (
  | { estado: "inicial" }
  | { estado: "error"; errores: ErroresCuenta & { general?: string }; valores: ValoresFormularioCuenta }
);

/** Eliminar y restaurar son un solo botón: si no se pudo, solo hay un mensaje que mostrar junto a él. */
export type EstadoBotonCuenta = { error?: string };

const texto = (formData: FormData, nombre: string) => {
  const valor = formData.get(nombre);
  return typeof valor === "string" ? valor : "";
};

/** Toda pantalla que lista o elige cuentas. */
function revalidar() {
  for (const ruta of ["/cuentas", "/", "/nuevo", "/movimientos", "/deudas", "/sobres"]) revalidatePath(ruta, "layout");
}

function valoresDe(formData: FormData): ValoresFormularioCuenta {
  return {
    nombre: texto(formData, "nombre"),
    moneda: texto(formData, "moneda"),
    tipo: texto(formData, "tipo"),
    icono: texto(formData, "icono"),
    color: texto(formData, "color"),
  };
}

/** Crea o edita (si llega `id`) una cuenta (spec 013, criterios 2 a 5). Al terminar, vuelve a Cuentas. */
export async function guardarCuenta(previo: EstadoCuenta, formData: FormData): Promise<EstadoCuenta> {
  const sesion = await leerSesion();
  if (!sesion) {
    // Sin redirigir: el formulario muestra el mensaje y conserva lo escrito (spec 002, criterio 19).
    const general = mensajeDeFalla("sesion", "no se guardó");
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: valoresDe(formData) };
  }
  const ronda = (previo?.ronda ?? 0) + 1;
  const valores = valoresDe(formData);

  const editando = texto(formData, "id") !== "";
  const id = z.coerce.number().int().positive().safeParse(texto(formData, "id"));
  const existentes = await cuentasConUso();
  const actual = editando && id.success ? existentes.find((c) => c.id === id.data) : undefined;
  if (editando && !actual) return { ronda, estado: "error", errores: { general: "Esa cuenta ya no existe" }, valores };

  const validada = validarCuenta(
    { ...valores, edicion: actual && { id: actual.id, moneda: actual.moneda, usos: actual.usos } },
    existentes,
  );
  if (!validada.ok) return { ronda, estado: "error", errores: validada.errores, valores };

  try {
    if (actual) {
      // La base vuelve a comprobar la moneda con la fila bloqueada: un movimiento pudo llegar después de validar.
      const resultado = await actualizarCuenta(actual.id, validada.valores);
      if (resultado === "moneda-fija") {
        return { ronda, estado: "error", errores: { moneda: "Tiene movimientos: la moneda no cambia" }, valores };
      }
      if (resultado === "no-existe") {
        return { ronda, estado: "error", errores: { general: "Esa cuenta ya no existe" }, valores };
      }
    } else {
      await crearCuenta(validada.valores);
    }
  } catch (error) {
    // El índice único del nombre es la última barrera si otra pestaña creó la misma a la vez.
    registrarFalla("No se pudo guardar la cuenta", error);
    return {
      ronda,
      estado: "error",
      errores: { general: "No se pudo guardar. Revisa el nombre e intenta de nuevo." },
      valores,
    };
  }

  revalidar();
  redirect("/cuentas");
}

/** Criterios 7 a 9 y 12: con saldo o prevista por una deuda no se toca; en 0, sin usos se borra y si no, se archiva. */
export async function eliminarCuentaAccion(_previo: EstadoBotonCuenta, formData: FormData): Promise<EstadoBotonCuenta> {
  const sesion = await leerSesion();
  if (!sesion) return { error: mensajeDeFalla("sesion", "no se guardó") };
  const cuenta = await cuentaPorId(Number(texto(formData, "id")));
  if (!cuenta) redirect("/cuentas");
  let resultado: Awaited<ReturnType<typeof eliminarCuenta>>;
  try {
    resultado = await eliminarCuenta(cuenta.id);
  } catch (error) {
    registrarFalla("No se pudo eliminar la cuenta", error);
    return { error: mensajeDeFalla("otra", "no se guardó") };
  }
  if (resultado === "con-saldo") return { error: "Tiene saldo: no se puede quitar sin descuadrar." };
  if (resultado === "prevista")
    return { error: "Es la cuenta prevista de una deuda pendiente: cámbiala allí primero." };
  revalidar();
  redirect("/cuentas");
}

/** Criterio 11: una archivada vuelve a la lista y a los formularios de registro. */
export async function restaurarCuentaAccion(
  _previo: EstadoBotonCuenta,
  formData: FormData,
): Promise<EstadoBotonCuenta> {
  const sesion = await leerSesion();
  if (!sesion) return { error: mensajeDeFalla("sesion", "no se guardó") };
  const id = z.coerce.number().int().positive().safeParse(texto(formData, "id"));
  if (!id.success) redirect("/cuentas");
  try {
    await restaurarCuenta(id.data);
  } catch (error) {
    registrarFalla("No se pudo restaurar la cuenta", error);
    return { error: mensajeDeFalla("otra", "no se guardó") };
  }
  revalidar();
  redirect("/cuentas");
}
