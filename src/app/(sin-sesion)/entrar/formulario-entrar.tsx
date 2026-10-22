"use client";

import { useActionState } from "react";
import { Boton, Campo, Entrada, ErrorCampo } from "@/components/formulario";
import { Tarjeta } from "@/components/ui";
import type { EstadoEntrar } from "./acciones";
import { entrarConFallas } from "./entrar-con-fallas";

/** Correo y contraseña. Sin JavaScript también funciona: el formulario va directo a la acción. */
export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoEntrar, FormData>(entrarConFallas, {
    ronda: 0,
    correo: "",
  });
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <Tarjeta className="flex flex-col gap-4">
        <Campo etiqueta="Correo">
          {/* Con la ronda como key, el correo se monta de nuevo con lo escrito tras cada respuesta. */}
          <Entrada
            key={estado.ronda}
            name="correo"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            defaultValue={estado.correo}
          />
        </Campo>
        <Campo etiqueta="Contraseña">
          <Entrada name="clave" type="password" autoComplete="current-password" required />
        </Campo>
      </Tarjeta>
      <ErrorCampo>{estado.error}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="h-[52px] w-full">
        Entrar
      </Boton>
    </form>
  );
}
