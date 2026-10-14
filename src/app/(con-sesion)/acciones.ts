"use server";

import { redirect } from "next/navigation";
import { exigirSesion } from "@/app/sesion";
import { clienteSupabase } from "@/app/supabase";

/**
 * Salir (spec 002, criterio 7): cierra la sesión también en Supabase, que revoca su token de renovación, borra las
 * cookies y lleva a /entrar. Solo la sesión de este dispositivo: salir en la computadora no saca al celular.
 */
export async function salir() {
  await exigirSesion();
  const supabase = await clienteSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/entrar");
}
