"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { Boton, Campo, CampoMonto, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { formatearCifra } from "@/lib/dinero";
import { moverConFallas } from "./mover-con-fallas";
import type { ErroresFormularioMover, EstadoMover, ValoresMover } from "./valores";

type Sobre = { id: number; nombre: string; tipo: string; saldoCentavos: number };

/**
 * Mover entre sobres (spec 007, criterios 7 y 8): de dónde, a dónde, cuánto y una nota. Desde Inversión, antes de
 * guardar, el aviso y un segundo botón para confirmar. Sin JavaScript, radios y un campo.
 */
export function FormularioMover({ inicial, sobres }: { inicial: ValoresMover; sobres: Sobre[] }) {
  const [estado, enviar, pendiente] = useActionState<EstadoMover, FormData>(moverConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={estado.ronda}
      sobres={sobres}
      valores={estado.estado === "inicial" ? inicial : estado.valores}
      errores={estado.estado === "error" ? estado.errores : {}}
      confirmar={estado.estado === "confirmar"}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  sobres,
  valores,
  errores,
  confirmar,
  enviar,
  pendiente,
}: {
  sobres: Sobre[];
  valores: ValoresMover;
  errores: ErroresFormularioMover;
  confirmar: boolean;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  const [origenId, setOrigenId] = useState(valores.origenId);
  const opciones = sobres.map((s) => ({
    valor: String(s.id),
    texto: s.nombre,
    detalle: formatearCifra(s.saldoCentavos),
  }));
  const inversion = sobres.find((s) => s.tipo === "inversion");
  const confirmando = confirmar && inversion !== undefined && origenId === String(inversion.id);

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />
      <SelectorPildoras
        etiqueta="De"
        name="origenId"
        opciones={opciones}
        valorInicial={valores.origenId}
        onCambio={setOrigenId}
        envolver
        error={errores.origen}
      />
      <SelectorPildoras
        etiqueta="A"
        name="destinoId"
        opciones={opciones}
        valorInicial={valores.destinoId}
        envolver
        error={errores.destino}
      />
      <Campo etiqueta="Cuánto mover" error={errores.monto}>
        <CampoMonto name="monto" defaultValue={valores.monto} unidad="USD" />
      </Campo>
      <Campo etiqueta="Nota" ayuda="Opcional">
        <Entrada name="nota" defaultValue={valores.nota} maxLength={200} autoComplete="off" />
      </Campo>

      {confirmando ? (
        <p role="alert" className="flex items-start gap-2 text-[13px] font-semibold text-negativo">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          Inversión es intocable: lo que sale de aquí deja de crecer. ¿Mover igual?
          <input type="hidden" name="confirmarInversion" value={inversion.id} />
        </p>
      ) : null}
      <ErrorCampo>{errores.general}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} autoFocus={confirmando} className="w-full">
        {pendiente ? "Moviendo…" : confirmando ? "Sí, mover de Inversión" : "Mover"}
      </Boton>
    </form>
  );
}
