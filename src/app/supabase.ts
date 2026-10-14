/**
 * Supabase solo en el servidor (spec 002, criterio 8). El navegador no tiene cliente de Supabase: ni la URL ni la
 * clave publicable le llegan. Aquí viven las credenciales, las opciones de las cookies de sesión y los dos clientes:
 * el del proxy, que lee y escribe cookies en la petición y en la respuesta, y el de páginas y acciones, que usa
 * cookies() de Next. Se crea uno nuevo en cada solicitud, como pide @supabase/ssr.
 */
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

/**
 * HttpOnly: ningún script del navegador lee la sesión. SameSite=Lax. Secure en producción; por la red local de la
 * casa no hay https y el navegador no guardaría la cookie. El mismo objeto en el proxy y en el servidor.
 */
const opcionesCookies: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function credenciales() {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) throw new Error("Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en el entorno del servidor.");
  return { url, clave };
}

/** Cliente para páginas y acciones. */
export async function clienteSupabase() {
  const almacen = await cookies();
  const { url, clave } = credenciales();
  return createServerClient(url, clave, {
    cookieOptions: opcionesCookies,
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(aPoner) {
        try {
          for (const { name, value, options } of aPoner) almacen.set(name, value, options);
        } catch {
          // En el render de una página Next no deja escribir cookies. El proxy ya renovó la sesión de esta solicitud.
        }
      },
    },
  });
}

/**
 * Cliente para el proxy. `respuesta()` devuelve la respuesta con las cookies renovadas, que también quedan en la
 * petición, para que las páginas de esta misma solicitud vean el token nuevo y no lo renueven otra vez.
 */
export function clienteSupabaseProxy(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });
  const { url, clave } = credenciales();
  const supabase = createServerClient(url, clave, {
    cookieOptions: opcionesCookies,
    cookies: {
      getAll: () => peticion.cookies.getAll(),
      setAll(aPoner, cabeceras) {
        for (const { name, value } of aPoner) peticion.cookies.set(name, value);
        respuesta = NextResponse.next({ request: peticion });
        for (const { name, value, options } of aPoner) respuesta.cookies.set(name, value, options);
        for (const [nombre, valor] of Object.entries(cabeceras)) respuesta.headers.set(nombre, valor);
      },
    },
  });
  return { supabase, respuesta: () => respuesta };
}
