"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { Boton, ErrorCampo } from "@/components/formulario";
import { conFallas, mensajeDeFalla } from "@/lib/fallas";
import { type EstadoBotonCuenta, eliminarCuentaAccion, restaurarCuentaAccion } from "./acciones";

/*
  Los dos botones de una sola acción de las cuentas (spec 013): eliminar o archivar, y restaurar. Sin red o con una
  versión vieja, el mensaje queda junto al botón y la pantalla en su sitio (spec 002, criterio 19).
*/

const mensaje = (_previo: EstadoBotonCuenta, _datos: FormData, causa: Parameters<typeof mensajeDeFalla>[0]) => ({
  error: mensajeDeFalla(causa, "no se guardó"),
});
const eliminarConFallas = conFallas<EstadoBotonCuenta>(eliminarCuentaAccion, mensaje);
const restaurarConFallas = conFallas<EstadoBotonCuenta>(restaurarCuentaAccion, mensaje);

/** "Sí, eliminar" o "Sí, archivar", dentro de la confirmación de editar cuenta (criterios 8 y 9). */
export function BotonEliminarCuenta({ id, archivar }: { id: number; archivar: boolean }) {
  const [estado, enviar, pendiente] = useActionState<EstadoBotonCuenta, FormData>(eliminarConFallas, {});
  return (
    <form action={enviar} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={id} />
      <ErrorCampo>{estado.error}</ErrorCampo>
      <Boton type="submit" variante="peligro" disabled={pendiente}>
        {archivar ? "Sí, archivar" : "Sí, eliminar"}
      </Boton>
    </form>
  );
}

/** "Restaurar" junto a una archivada (criterio 11). */
export function BotonRestaurarCuenta({ id, nombre }: { id: number; nombre: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoBotonCuenta, FormData>(restaurarConFallas, {});
  return (
    <form action={enviar} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pendiente}
        aria-label={`Restaurar ${nombre}`}
        className="flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold text-enlace hover:bg-tarjeta-hover focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        <RotateCcw size={13} aria-hidden />
        Restaurar
      </button>
      <ErrorCampo>{estado.error}</ErrorCampo>
    </form>
  );
}
