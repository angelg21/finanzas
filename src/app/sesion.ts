/**
 * La sesión del único usuario (spec 002, criterios 1 a 3). Cada page.tsx con datos y cada server action la exigen
 * como primera instrucción. No se fían del proxy: una acción que cambie de ruta, o un matcher que se toque, lo
 * dejaría sin cubrir.
 */
import { redirect } from "next/navigation";
import { cache } from "react";
import { esUsuarioPermitido } from "@/lib/acceso";
import { clienteSupabase } from "./supabase";

export type Sesion = { correo: string };

/**
 * La sesión vigente del usuario permitido, o null. getClaims verifica el token aquí mismo, con las claves públicas
 * del proyecto, sin ir al servidor de Auth mientras el token siga vigente (criterio 21). `cache` la calcula una sola
 * vez por solicitud aunque la pidan la página y sus partes.
 */
export const leerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await clienteSupabase();
  const { data } = await supabase.auth.getClaims();
  const correo = data?.claims.email;
  return correo && esUsuarioPermitido(correo, process.env.USUARIO_PERMITIDO) ? { correo } : null;
});

/** La sesión, o a /entrar. Sin sesión no se ejecuta nada de lo que sigue: ni la consulta ni la escritura. */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await leerSesion();
  if (!sesion) redirect("/entrar");
  return sesion;
}
