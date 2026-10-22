"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import { Boton, Campo, CampoMonto, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { Pildora } from "@/components/ui";
import { unidadDe } from "@/lib/dinero";
import { anotarConFallas } from "./anotar-con-fallas";
import type { ErroresFormularioPorCompletar, EstadoPorCompletar, ValoresPorCompletar } from "./valores";

type Datos = {
  categorias: { id: number; nombre: string; icono: string; color: string }[];
  hoy: string;
};

const vacio = (idCaptura: string): ValoresPorCompletar => ({
  idCaptura,
  categoriaId: "",
  nota: "",
  fecha: "hoy",
  monto: "",
  moneda: "VES",
});

/**
 * Anotar un gasto por completar (spec 009, criterio 2): categoría, descripción, fecha y, si se sabe, el monto en Bs o
 * USD. Al anotar, vuelve vacío para el siguiente, con "Anotado" y cuántos hay.
 */
export function FormularioPorCompletar({ idCaptura, ...datos }: Datos & { idCaptura: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoPorCompletar, FormData>(anotarConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  const valores =
    estado.estado === "error"
      ? estado.valores
      : vacio(estado.estado === "anotado" ? estado.siguienteCaptura : idCaptura);
  return (
    <div className="flex flex-col gap-4">
      {estado.estado === "anotado" ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2">
          <Pildora tono="positiva">
            <CheckCircle2 size={13} aria-hidden />
            Anotado · {estado.cantidad} por completar
          </Pildora>
          <Link href="/por-completar" className="text-[13px] font-semibold text-enlace hover:text-texto">
            Ver la lista
          </Link>
        </div>
      ) : null}
      <Campos
        key={estado.ronda}
        {...datos}
        valores={valores}
        errores={estado.estado === "error" ? estado.errores : {}}
        enviar={enviar}
        pendiente={pendiente}
      />
    </div>
  );
}

function Campos({
  categorias,
  hoy,
  valores,
  errores,
  enviar,
  pendiente,
}: Datos & {
  valores: ValoresPorCompletar;
  errores: ErroresFormularioPorCompletar;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  const [fecha, setFecha] = useState(valores.fecha);
  const [moneda, setMoneda] = useState(valores.moneda || "VES");
  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />
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
      <Campo etiqueta="Descripción" ayuda="Opcional: dónde o qué fue" error={undefined}>
        <Entrada name="nota" defaultValue={valores.nota} maxLength={200} autoComplete="off" />
      </Campo>
      <SelectorFecha name="fecha" valor={fecha} hoy={hoy} onCambio={setFecha} error={errores.fecha} />
      <Campo etiqueta="Monto, si lo sabes" error={errores.monto}>
        <CampoMonto name="monto" defaultValue={valores.monto} unidad={unidadDe(moneda)} />
      </Campo>
      <SelectorPildoras
        etiqueta="En"
        name="moneda"
        opciones={[
          { valor: "VES", texto: "Bs" },
          { valor: "USD", texto: "USD" },
        ]}
        valorInicial={moneda}
        onCambio={setMoneda}
        error={errores.moneda}
      />
      <ErrorCampo>{errores.general}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="w-full">
        {pendiente ? "Anotando…" : "Anotar"}
      </Boton>
    </form>
  );
}
