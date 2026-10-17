"use client";

import { useActionState } from "react";
import type { ValoresGasto } from "../../nuevo/gasto/acciones";
import { type CuentaGasto, CamposGasto, type SobreGasto } from "../../nuevo/gasto/formulario-gasto";
import { editarGastoConFallas } from "./editar-con-fallas";
import type { EstadoEdicionGasto } from "./valores";

type Datos = {
  id: number;
  volver: string;
  inicial: ValoresGasto;
  categorias: { id: number; nombre: string; icono: string; color: string }[];
  etiquetas: { id: number; nombre: string }[];
  sobres: SobreGasto[];
  cuentas: CuentaGasto[];
  hoy: string;
};

/**
 * Editar un gasto (spec 006, criterios 2 y 3): los campos de la captura con sus valores. El sobre ya está elegido,
 * así que cambiar la categoría no lo mueve. Al guardar se vuelve a la lista con "Gasto actualizado".
 */
export function FormularioEditarGasto({ id, volver, inicial, ...datos }: Datos) {
  const [estado, enviar, pendiente] = useActionState<EstadoEdicionGasto, FormData>(editarGastoConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <CamposGasto
      key={estado.ronda}
      {...datos}
      valores={estado.estado === "inicial" ? inicial : estado.valores}
      errores={estado.estado === "error" ? estado.errores : {}}
      confirmar={estado.estado === "confirmar"}
      primeraVez={false}
      sobreTocado
      alTocarSobre={() => {}}
      enviar={enviar}
      pendiente={pendiente}
      textoBoton="Guardar cambios"
      conAntesYDespues={false}
      conNuevaCategoria={false}
      ocultos={
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="volver" value={volver} />
        </>
      }
    />
  );
}
