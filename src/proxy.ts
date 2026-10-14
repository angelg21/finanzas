/**
 * Proxy (spec 002, criterios 1, 3, 6 y 7). En cada solicitud renueva la sesión de Supabase. En una navegación (GET)
 * sin sesión, redirige a /entrar?siguiente=<ruta>; con sesión, /entrar lleva a /. Una sesión de otro correo se
 * cierra. Todo lo que pasa por aquí sale con Cache-Control: private, no-store, para que "atrás" después de salir no
 * muestre datos.
 *
 * No redirige los POST de las server actions: el fetch que las llama seguiría la redirección y fallaría sin decir
 * nada; cada acción exige la sesión por su cuenta y responde ella misma (src/app/sesion.ts). Sin sesión, un POST que
 * no es una server action (un formulario enviado sin JavaScript, o cualquier otro) va con 303 a /entrar: así la
 * respuesta pide entrar y nada se escribe. El proxy es la primera capa, no la única.
 */
import { type NextRequest, NextResponse } from "next/server";
import { clienteSupabaseProxy } from "@/app/supabase";
import { esUsuarioPermitido } from "@/lib/acceso";

/** Otra respuesta que conserva las cookies renovadas o borradas en esta solicitud. */
function conCookies(nueva: NextResponse, de: NextResponse) {
  for (const cookie of de.cookies.getAll()) nueva.cookies.set(cookie);
  return nueva;
}

export async function proxy(peticion: NextRequest) {
  const { supabase, respuesta } = clienteSupabaseProxy(peticion);
  // Nada entre crear el cliente y getClaims: así lo pide @supabase/ssr para no perder la renovación.
  const { data } = await supabase.auth.getClaims();
  const correo = data?.claims.email;
  const conSesion = Boolean(correo) && esUsuarioPermitido(correo, process.env.USUARIO_PERMITIDO);
  if (data?.claims && !conSesion) await supabase.auth.signOut();

  const { pathname, search } = peticion.nextUrl;
  // Solo GET, HEAD y POST: con PUT, PATCH o DELETE Next renderiza la página, y una cabecera next-action la
  // colaba sin sesión (auditoría T14, hallazgo 2).
  if (!["GET", "HEAD", "POST"].includes(peticion.method)) {
    return conCookies(new NextResponse(null, { status: 405, headers: { Allow: "GET, HEAD, POST" } }), respuesta());
  }
  const navegacion = peticion.method === "GET" || peticion.method === "HEAD";
  const esAccion = peticion.method === "POST" && peticion.headers.has("next-action");
  const entrar = new URL("/entrar", peticion.url);
  entrar.searchParams.set("siguiente", pathname + search);
  let salida = respuesta();
  if (navegacion && !conSesion && pathname !== "/entrar") {
    salida = conCookies(NextResponse.redirect(entrar), salida);
  } else if (navegacion && conSesion && pathname === "/entrar") {
    salida = conCookies(NextResponse.redirect(new URL("/", peticion.url)), salida);
  } else if (!navegacion && !esAccion && !conSesion && pathname !== "/entrar") {
    // 303: el navegador sigue con un GET, sin volver a enviar el formulario.
    salida = conCookies(NextResponse.redirect(entrar, 303), salida);
  }
  salida.headers.set("Cache-Control", "private, no-store");
  return salida;
}

export const config = {
  matcher: [
    /*
     * Todo menos lo que responde sin sesión: los archivos de Next, el favicon, el manifiesto, el service worker,
     * los iconos y /sin-conexion. Una ruta nueva queda cubierta sin tocar esta lista.
     */
    "/((?!_next/static|_next/image|favicon\\.ico$|manifest\\.webmanifest$|sw\\.js$|sin-conexion$|icon$|icon/|apple-icon$|icono-adaptable$).*)",
  ],
};
