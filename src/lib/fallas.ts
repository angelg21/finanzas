/**
 * Guardar nunca miente (spec 002, criterio 19). Cuando una acción del formulario falla por la red o porque el
 * servidor ya no la conoce, la pantalla no se pierde: la falla se vuelve un estado del formulario, con lo escrito
 * y un mensaje por causa. Nada se encola ni se reintenta solo. La sesión vencida no llega aquí: la acción la
 * comprueba y responde ella misma.
 */

export type CausaFalla = "sin-red" | "version" | "otra";

/**
 * Por qué falló. "de-next" no es una falla: son las redirecciones y los 404 de Next, que llegan como errores con
 * un `digest` que empieza por "NEXT_" y que Next tiene que recibir.
 */
export function causaDeFalla(error: unknown): CausaFalla | "de-next" {
  if (typeof error !== "object" || error === null) return "otra";
  const { digest, name } = error as { digest?: unknown; name?: unknown };
  if (typeof digest === "string" && digest.startsWith("NEXT_")) return "de-next";
  // El fetch de la acción falla con TypeError sin red: "Failed to fetch", "Load failed", "NetworkError…".
  if (error instanceof TypeError) return "sin-red";
  // Next: la acción de una página vieja que el despliegue nuevo ya no tiene.
  if (name === "UnrecognizedActionError") return "version";
  return "otra";
}

/** El mensaje junto al botón. `queNoSeGuardo` nombra lo perdido: el gasto, o nada en categorías y sobres. */
export function mensajeDeFalla(causa: CausaFalla | "sesion", queNoSeGuardo = "el gasto no se guardó"): string {
  switch (causa) {
    case "sin-red":
      return `Sin conexión: ${queNoSeGuardo}.`;
    case "sesion":
      return `Tu sesión terminó: ${queNoSeGuardo}. Entra de nuevo.`;
    case "version":
      return "La app se actualizó: recarga y vuelve a guardar.";
    default:
      return "No se pudo guardar. Intenta de nuevo.";
  }
}

type Accion<E> = (previo: E, datos: FormData) => Promise<E>;

/**
 * La acción del servidor envuelta para `useActionState`: si falla, devuelve `alFallar(...)` en vez de lanzar, que
 * llevaría la falla al límite de errores y borraría la pantalla.
 *
 * Sin JavaScript el formulario tiene que seguir yendo directo a la acción del servidor. React decide eso con las
 * marcas que la acción trae ($$FORM_ACTION, $$IS_SIGNATURE_EQUAL y su `bind`, que liga el estado inicial): se
 * copian a la envoltura, de modo que el HTML del servidor apunta a la acción original. Son internas de React; si
 * faltan, la envoltura funciona igual, solo que sin el respaldo sin JavaScript.
 */
export function conFallas<E>(accion: Accion<E>, alFallar: (previo: E, datos: FormData, causa: CausaFalla) => E) {
  const envuelta: Accion<E> = async (previo, datos) => {
    try {
      return await accion(previo, datos);
    } catch (error) {
      const causa = causaDeFalla(error);
      if (causa === "de-next") throw error;
      return alFallar(previo, datos, causa);
    }
  };
  const marcas = accion as unknown as { $$FORM_ACTION?: unknown; $$IS_SIGNATURE_EQUAL?: unknown };
  if (typeof marcas.$$FORM_ACTION === "function") {
    Object.assign(envuelta, {
      $$FORM_ACTION: marcas.$$FORM_ACTION,
      $$IS_SIGNATURE_EQUAL: marcas.$$IS_SIGNATURE_EQUAL,
      bind: (...argumentos: Parameters<Accion<E>["bind"]>) => accion.bind(...argumentos),
    });
  }
  return envuelta;
}
