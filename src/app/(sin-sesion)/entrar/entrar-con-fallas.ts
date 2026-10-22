import { conFallas, mensajeDeFallaAlEntrar } from "@/lib/fallas";
import { type EstadoEntrar, entrar } from "./acciones";

/**
 * Entrar sin que una falla de red cambie la pantalla por el error de Next (spec 002, criterio 19): el mensaje junto al
 * botón y el correo sigue escrito. La contraseña, como siempre, no vuelve.
 */
export const entrarConFallas = conFallas<EstadoEntrar>(entrar, (previo, datos, causa) => ({
  ronda: (previo?.ronda ?? 0) + 1,
  correo: String(datos.get("correo") ?? "").trim(),
  error: mensajeDeFallaAlEntrar(causa),
}));
