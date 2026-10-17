"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { ErrorCampo } from "@/components/formulario";
import type { EstadoBoton } from "./acciones";
import { restaurarConFallas } from "./restaurar-con-fallas";

/** "Restaurar" bajo una archivada (spec 001, criterio 22). Si falla, el mensaje queda debajo y la lista sigue. */
export function BotonRestaurar({ id }: { id: number }) {
  const [estado, enviar, pendiente] = useActionState<EstadoBoton, FormData>(restaurarConFallas, {});
  return (
    <form action={enviar} className="flex flex-col items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pendiente}
        className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-enlace hover:bg-tarjeta-hover disabled:opacity-60"
      >
        <RotateCcw size={12} aria-hidden />
        Restaurar
      </button>
      <ErrorCampo>{estado.error}</ErrorCampo>
    </form>
  );
}
