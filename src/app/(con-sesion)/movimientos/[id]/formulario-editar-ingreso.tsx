"use client";

import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import { SelectorEtiqueta } from "@/components/selector-etiqueta";
import { Boton, Campo, CampoMonto, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { unidadDe } from "@/lib/dinero";
import { editarIngresoConFallas } from "./editar-con-fallas";
import type { ErroresIngresoEditado, EstadoEdicionIngreso, ValoresIngresoEditado } from "./valores";

type Datos = {
  id: number;
  volver: string;
  inicial: ValoresIngresoEditado;
  /** Las cuentas activas en dólares. */
  cuentas: { id: number; nombre: string; moneda: string }[];
  categorias: { id: number; nombre: string; icono: string; color: string }[];
  etiquetas: { id: number; nombre: string }[];
  /** "Se repartió: Gastos del mes 175,00 · Familia 100,00", o null si no tiene reparto. */
  reparto: string | null;
  hoy: string;
};

/**
 * Editar un ingreso (spec 006, criterios 4 y 5): monto, cuenta, categoría, fecha y nota. La diferencia de monto
 * entra o sale de "Por asignar"; el reparto no cambia, y la línea de abajo lo recuerda.
 */
export function FormularioEditarIngreso({ inicial, ...datos }: Datos) {
  const [estado, enviar, pendiente] = useActionState<EstadoEdicionIngreso, FormData>(editarIngresoConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={estado.ronda}
      {...datos}
      valores={estado.estado === "error" ? estado.valores : inicial}
      errores={estado.estado === "error" ? estado.errores : {}}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  id,
  volver,
  cuentas,
  categorias,
  etiquetas,
  reparto,
  hoy,
  valores,
  errores,
  enviar,
  pendiente,
}: Omit<Datos, "inicial"> & {
  valores: ValoresIngresoEditado;
  errores: ErroresIngresoEditado;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  const [cuentaId, setCuentaId] = useState(valores.cuentaId);
  const [fecha, setFecha] = useState(valores.fecha);
  const moneda = cuentas.find((c) => String(c.id) === cuentaId)?.moneda ?? "USD";

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="volver" value={volver} />

      <Campo etiqueta="Monto" error={errores.monto}>
        <CampoMonto name="monto" defaultValue={valores.monto} unidad={unidadDe(moneda)} />
      </Campo>
      {reparto ? <p className="-mt-3 text-[13px] text-texto-3">{reparto}</p> : null}

      <SelectorPildoras
        etiqueta="Cuenta"
        name="cuentaId"
        opciones={cuentas.map((c) => ({ valor: String(c.id), texto: c.nombre, detalle: c.moneda }))}
        valorInicial={valores.cuentaId}
        onCambio={setCuentaId}
        envolver
        error={errores.cuenta}
      />

      <SelectorPildoras
        etiqueta="Categoría"
        name="categoriaId"
        envolver
        opciones={categorias.map((c) => ({
          valor: String(c.id),
          texto: c.nombre,
          categoria: { icono: c.icono, color: c.color },
        }))}
        valorInicial={valores.categoriaId}
        error={errores.categoria}
      />

      <SelectorEtiqueta
        etiquetas={etiquetas}
        valorInicial={valores.etiquetaId}
        nuevaInicial={valores.etiquetaNueva}
        error={errores.etiqueta}
      />

      <SelectorFecha name="fecha" valor={fecha} hoy={hoy} onCambio={setFecha} error={errores.fecha} />

      <Campo etiqueta="Nota" ayuda="Opcional">
        <Entrada name="nota" defaultValue={valores.nota} maxLength={200} autoComplete="off" />
      </Campo>

      <ErrorCampo>{errores.general}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="w-full">
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </Boton>
    </form>
  );
}
