"use server";

import { isAuthApiError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { clienteSupabase } from "@/app/supabase";
import { destinoSeguro, esUsuarioPermitido } from "@/lib/acceso";

export type EstadoEntrar = { ronda: number; correo: string; error?: string };

const mensajes = {
  credenciales: "Correo o contraseña incorrectos.",
  intentos: "Demasiados intentos. Espera unos minutos.",
  fallo: "No se pudo entrar. Revisa la conexión e intenta de nuevo.",
};

/**
 * Entrar (spec 002, criterios 3 a 5). La única acción que no exige sesión, porque la crea. Siempre pregunta a
 * Supabase, también por un correo que no es el permitido: responder antes delataría cuál es. Si la cuenta existe
 * pero no es la de USUARIO_PERMITIDO, cierra la sesión recién abierta y da el mismo error que una contraseña
 * equivocada. El correo vuelve al formulario; la contraseña, nunca.
 */
export async function entrar(previo: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const ronda = (previo?.ronda ?? 0) + 1;
  const correo = String(formData.get("correo") ?? "").trim();
  const clave = String(formData.get("clave") ?? "");
  const destino = destinoSeguro(String(formData.get("siguiente") ?? ""));
  if (!correo || !clave) return { ronda, correo, error: mensajes.credenciales };

  const supabase = await clienteSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) {
    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return { ronda, correo, error: mensajes.intentos };
    }
    // Cualquier rechazo de Supabase se dice igual, sin aclarar si falló el correo o la contraseña.
    return { ronda, correo, error: isAuthApiError(error) ? mensajes.credenciales : mensajes.fallo };
  }
  if (!esUsuarioPermitido(data.user?.email, process.env.USUARIO_PERMITIDO)) {
    await supabase.auth.signOut();
    return { ronda, correo, error: mensajes.credenciales };
  }
  redirect(destino);
}
