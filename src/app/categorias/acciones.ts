"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  actualizarCategoria,
  categoriaPorId,
  categoriasConUso,
  crearCategoria,
  eliminarCategoria,
  restaurarCategoria,
} from "@/db/categorias";
import { vueltaConCategoria } from "@/lib/borrador-captura";
import { type ErroresCategoria, type TipoCategoria, repetidaDe, validarCategoria } from "@/lib/categorias";

/** Lo tecleado, para volver a llenar el formulario si hay que corregir. */
export type ValoresCategoria = { nombre: string; tipo: TipoCategoria; icono: string; color: string };

export type EstadoCategoria = { ronda: number } & (
  | { estado: "inicial" }
  /** `archivada`: id de una archivada con el mismo nombre, para ofrecer restaurarla (criterio 19). */
  | { estado: "error"; errores: ErroresCategoria & { general?: string }; valores: ValoresCategoria; archivada?: number }
);

/** A dónde puede volver el formulario tras crear o restaurar: solo rutas conocidas, nunca otra dirección. */
const destinos = ["/nuevo/gasto"];

const texto = (formData: FormData, nombre: string) => {
  const valor = formData.get(nombre);
  return typeof valor === "string" ? valor : "";
};

function revalidar() {
  for (const ruta of ["/categorias", "/nuevo/gasto", "/movimientos", "/"]) revalidatePath(ruta);
}

/** Crea o edita (si llega `id`) una categoría. Al terminar, vuelve a la lista o a la captura de gasto. */
export async function guardarCategoria(previo: EstadoCategoria, formData: FormData): Promise<EstadoCategoria> {
  const ronda = (previo?.ronda ?? 0) + 1;
  const valores: ValoresCategoria = {
    nombre: texto(formData, "nombre"),
    tipo: texto(formData, "tipo") === "ingreso" ? "ingreso" : "gasto",
    icono: texto(formData, "icono"),
    color: texto(formData, "color"),
  };
  const id = z.coerce.number().int().positive().safeParse(texto(formData, "id"));
  const editando = texto(formData, "id") !== "";

  const existentes = await categoriasConUso();
  const actual = editando && id.success ? existentes.find((c) => c.id === id.data) : undefined;
  if (editando && !actual) {
    return { ronda, estado: "error", errores: { general: "Esa categoría ya no existe" }, valores };
  }

  const validada = validarCategoria(
    { ...valores, edicion: actual && { id: actual.id, tipo: actual.tipo, movimientos: actual.movimientos } },
    existentes,
  );
  if (!validada.ok) {
    return { ronda, estado: "error", errores: validada.errores, valores, archivada: validada.archivada };
  }

  let guardada: number;
  try {
    if (actual) {
      // La base vuelve a comprobar el tipo con la fila bloqueada: un movimiento pudo llegar después de validar.
      const resultado = await actualizarCategoria(actual.id, validada.valores);
      if (resultado === "tipo-fijo") {
        return { ronda, estado: "error", errores: { tipo: "Tiene movimientos: no puede cambiar de tipo" }, valores };
      }
      if (resultado === "no-existe") {
        return { ronda, estado: "error", errores: { general: "Esa categoría ya no existe" }, valores };
      }
      guardada = actual.id;
    } else {
      guardada = await crearCategoria(validada.valores);
    }
  } catch (error) {
    // El índice único (tipo, nombre) es la última barrera si otra pestaña creó la misma a la vez.
    console.error("No se pudo guardar la categoría", error);
    return {
      ronda,
      estado: "error",
      errores: { general: "No se pudo guardar. Revisa el nombre e intenta de nuevo." },
      valores,
    };
  }

  revalidar();
  // Desde la captura, de vuelta a ella con lo escrito y la categoría nueva elegida (criterio 25).
  redirect(
    vueltaConCategoria(texto(formData, "volver"), guardada, destinos) ?? `/categorias?tipo=${validada.valores.tipo}`,
  );
}

/** Criterio 21: borra la categoría si no tiene movimientos; si los tiene, la archiva. */
export async function eliminarCategoriaAccion(formData: FormData) {
  const categoria = await categoriaPorId(Number(texto(formData, "id")));
  if (!categoria) redirect("/categorias");
  await eliminarCategoria(categoria.id);
  revalidar();
  redirect(`/categorias?tipo=${categoria.tipo}`);
}

/**
 * Criterios 19 y 22: restaura una archivada. Lee `restaurar` (el formulario aparte del botón "Restaurar la
 * archivada", al crear o editar) o, si no viene, `id` (la lista de archivadas). Si se llegó desde la
 * captura, vuelve a ella con la categoría elegida, como al crear (25).
 */
export async function restaurarCategoriaAccion(formData: FormData) {
  const id = Number(texto(formData, "restaurar") || texto(formData, "id"));
  const existentes = await categoriasConUso();
  const categoria = existentes.find((c) => c.id === id);
  if (!categoria) redirect("/categorias");
  // La base solo impide el nombre exacto: "Comida" archivada y "comida" activa acabarían las dos activas.
  const activas = existentes.filter((c) => c.activa);
  if (repetidaDe(categoria.nombre, categoria.tipo, activas, categoria.id)) {
    redirect(`/categorias?tipo=${categoria.tipo}&archivadas=1&aviso=nombre`);
  }
  await restaurarCategoria(categoria.id);
  revalidar();
  redirect(
    vueltaConCategoria(texto(formData, "volver"), categoria.id, destinos) ?? `/categorias?tipo=${categoria.tipo}`,
  );
}
