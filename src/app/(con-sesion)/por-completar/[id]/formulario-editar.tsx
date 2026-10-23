"use client";

import { useActionState } from "react";
import { CamposPorCompletar } from "../../nuevo/por-completar/formulario-por-completar";
import type { EstadoPorCompletar, ValoresPorCompletar } from "../../nuevo/por-completar/valores";
import { editarPorCompletarConFallas } from "./editar-con-fallas";

type Datos = {
  id: number;
  categorias: { id: number; nombre: string; icono: string; color: string }[];
  hoy: string;
  inicial: ValoresPorCompletar;
};

/** El formulario de anotar, lleno con lo anotado y con "Guardar cambios" (spec 010, criterio 1). */
export function FormularioEditarPorCompletar({ id, inicial, ...datos }: Datos) {
  const [estado, enviar, pendiente] = useActionState<EstadoPorCompletar, FormData>(editarPorCompletarConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <CamposPorCompletar
      key={estado.ronda}
      {...datos}
      valores={estado.estado === "error" ? estado.valores : inicial}
      errores={estado.estado === "error" ? estado.errores : {}}
      enviar={enviar}
      pendiente={pendiente}
      ocultos={<input type="hidden" name="id" value={id} />}
      textoBoton={["Guardar cambios", "Guardando…"]}
    />
  );
}
