"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Boton, Campo, Entrada, ErrorCampo, Selector } from "@/components/formulario";
import { centavosATexto } from "@/lib/dinero";
import { type CausaFalla, conFallas, mensajeDeFalla } from "@/lib/fallas";
import { agregarPartida, eliminarPartida, fijarAporteManual, type EstadoFormulario } from "./acciones";

/** Sin red o con una versión vieja, el mensaje junto al botón, sin perder la pantalla (spec 002, criterio 19). */
const alFallar = (_previo: EstadoFormulario, _datos: FormData, causa: CausaFalla): EstadoFormulario => ({
  error: mensajeDeFalla(causa, "no se guardó"),
});

export const nombresMes = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Alta de una ocasión. Al guardar con éxito el formulario se reinicia (cambia su key). */
export function FormularioPartida({ sobreId }: { sobreId: number }) {
  const accion = conFallas(agregarPartida.bind(null, sobreId), alFallar);
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form key={estado.ok ?? 0} action={enviar} className="grid grid-cols-2 gap-3">
      <Campo etiqueta="Ocasión" className="col-span-2">
        <Entrada name="nombre" placeholder="Cumpleaños de mamá" required maxLength={80} autoComplete="off" />
      </Campo>
      <Campo etiqueta="Monto estimado (USD)">
        <Entrada name="monto" inputMode="decimal" placeholder="40" required autoComplete="off" />
      </Campo>
      <Campo etiqueta="Veces al año">
        <Entrada name="veces" type="number" min={1} max={52} defaultValue={1} required />
      </Campo>
      <Campo etiqueta="Mes" ayuda="Opcional. Sirve para saber cuándo cae." className="col-span-2">
        <Selector name="mes" defaultValue="">
          <option value="">Sin mes fijo</option>
          {nombresMes.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Selector>
      </Campo>
      {estado.error ? (
        <p role="alert" className="col-span-2 text-[13px] font-semibold text-negativo">
          {estado.error}
        </p>
      ) : null}
      <div className="col-span-2">
        <Boton type="submit" disabled={pendiente} className="w-full">
          <Plus size={18} strokeWidth={2.6} aria-hidden />
          {pendiente ? "Guardando…" : "Agregar al desglose"}
        </Boton>
      </div>
    </form>
  );
}

const quitarConFallas = conFallas(eliminarPartida, alFallar);

/**
 * Botón de borrar una ocasión. Si falla, el mensaje ocupa una línea propia bajo la fila (que la envuelve) y la
 * ocasión sigue en su sitio.
 */
export function BotonEliminarPartida({ id, sobreId, nombre }: { id: number; sobreId: number; nombre: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(quitarConFallas, {});
  return (
    <>
      <form action={enviar}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="sobreId" value={sobreId} />
        <Boton type="submit" variante="peligro-palida" disabled={pendiente} aria-label={`Quitar ${nombre}`}>
          <Trash2 size={15} aria-hidden />
        </Boton>
      </form>
      {estado.error ? (
        <span className="basis-full text-right">
          <ErrorCampo palida>{estado.error}</ErrorCampo>
        </span>
      ) : null}
    </>
  );
}

/** Aporte mensual a mano, para cuando todavía no hay desglose. */
export function FormularioAporte({ sobreId, actualCentavos }: { sobreId: number; actualCentavos: number }) {
  const accion = conFallas(fijarAporteManual.bind(null, sobreId), alFallar);
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(accion, {});
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Campo
        etiqueta="Aporte mensual (USD)"
        ayuda="Se usa mientras el sobre no tenga desglose. Con desglose, se calcula solo."
      >
        <Entrada
          name="monto"
          inputMode="decimal"
          defaultValue={centavosATexto(actualCentavos)}
          required
          autoComplete="off"
        />
      </Campo>
      {estado.error ? (
        <p role="alert" className="text-[13px] font-semibold text-palida-negativo">
          {estado.error}
        </p>
      ) : null}
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar aporte"}
      </Boton>
    </form>
  );
}
