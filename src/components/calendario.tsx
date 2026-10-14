"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import {
  type Mes,
  celdasDelMes,
  esFecha,
  etiquetaFecha,
  fechaDesdeAtajo,
  fechaLarga,
  mesDe,
  moverMes,
  nombreMes,
} from "@/lib/fechas";
import { pildoraElegida, pildoraNormal, pildoraOpcion } from "./formulario";

const iniciales = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Fecha de un movimiento: píldoras "Hoy" y "Ayer" y, para cualquier otro día, un calendario propio en una
 * ventana modal pequeña, con los tokens de la app en vez del selector del navegador, que no se puede
 * estilizar. No deja elegir días futuros. La ventana es un <dialog>: Escape la cierra, el foco queda dentro
 * y tocar fuera también la cierra.
 * `valor` es lo que viaja en el campo oculto, tal como se tocó: "hoy" o "ayer" si se tocó ese atajo, que el
 * servidor resuelve al guardar (fechaDesdeAtajo) y no con el día en que se abrió la pantalla; o el día elegido
 * en el calendario, que se guarda tal cual aunque coincida con hoy. Sin JavaScript, un campo de fecha nativo
 * dentro de <noscript> va antes con el mismo nombre, así que es el que se lee, y las píldoras no se ven.
 */
export function SelectorFecha({
  name,
  valor,
  hoy,
  onCambio,
  error,
}: {
  name: string;
  valor: string;
  hoy: string;
  onCambio: (fecha: string) => void;
  error?: string;
}) {
  const ventana = useRef<HTMLDialogElement>(null);
  // El día que representa el valor, para pintarlo; vacío si llegó algo que no es una fecha (sin JavaScript).
  const resuelta = fechaDesdeAtajo(valor, hoy);
  const dia = esFecha(resuelta) ? resuelta : "";
  const [vista, setVista] = useState<Mes>(() => mesDe(dia || hoy));
  const otra = valor !== "hoy" && valor !== "ayer" && dia !== "";

  const elegir = (fecha: string) => {
    onCambio(fecha);
    ventana.current?.close();
  };
  const estilo = (elegida: boolean) => `${pildoraOpcion} ${elegida ? pildoraElegida : pildoraNormal}`;

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-semibold text-texto-3">Fecha</legend>
      <noscript>
        <input
          type="date"
          name={name}
          defaultValue={dia}
          max={hoy}
          aria-label="Fecha"
          className="h-12 w-full rounded-[14px] border border-tarjeta-borde bg-tarjeta-hover px-4 text-[16px] text-texto lg:text-[15px]"
        />
      </noscript>
      <input type="hidden" name={name} value={valor} />

      <div className="flex flex-wrap gap-2 noscript:hidden">
        <button
          type="button"
          aria-pressed={valor === "hoy"}
          onClick={() => elegir("hoy")}
          className={estilo(valor === "hoy")}
        >
          Hoy
        </button>
        <button
          type="button"
          aria-pressed={valor === "ayer"}
          onClick={() => elegir("ayer")}
          className={estilo(valor === "ayer")}
        >
          Ayer
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={otra ? `Otra fecha: ${fechaLarga(dia)}` : "Otra fecha"}
          onClick={() => {
            setVista(mesDe(dia || hoy));
            ventana.current?.showModal();
            // El foco va al día elegido, no a la primera flecha. Tras pintar el mes, que pudo cambiar.
            requestAnimationFrame(() =>
              ventana.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus(),
            );
          }}
          className={estilo(otra)}
        >
          <CalendarDays size={16} aria-hidden />
          {otra ? etiquetaFecha(dia) : "Otra fecha"}
        </button>
      </div>

      <dialog
        ref={ventana}
        aria-label="Elegir fecha"
        // Un clic cuyo destino es el propio <dialog> cayó en el velo, fuera del contenido.
        onClick={(e) => {
          if (e.target === e.currentTarget) ventana.current?.close();
        }}
        className="m-auto w-[300px] max-w-[calc(100vw-32px)] rounded-[20px] border border-tarjeta-borde bg-tarjeta p-0 text-texto shadow-panel backdrop:bg-velo"
      >
        <Calendario
          vista={vista}
          alMover={(delta) => setVista((v) => moverMes(v, delta))}
          valor={dia}
          hoy={hoy}
          alElegir={elegir}
        />
      </dialog>

      {error ? (
        <span role="alert" className="text-[12px] font-semibold text-negativo">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

/** Un mes en cuadrícula de lunes a domingo. El hoy va con anillo; lo elegido, en menta; lo futuro, apagado. */
function Calendario({
  vista,
  alMover,
  valor,
  hoy,
  alElegir,
}: {
  vista: Mes;
  alMover: (delta: number) => void;
  valor: string;
  hoy: string;
  alElegir: (fecha: string) => void;
}) {
  const actual = mesDe(hoy);
  const enMesActual = vista.anio === actual.anio && vista.mes === actual.mes;
  const navegar =
    "grid size-8 place-items-center rounded-full bg-tarjeta-hover text-texto-2 enabled:hover:text-texto disabled:opacity-30";

  return (
    <div className="p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <button type="button" aria-label="Mes anterior" onClick={() => alMover(-1)} className={navegar}>
          <ChevronLeft size={16} aria-hidden />
        </button>
        <p aria-live="polite" className="text-[14px] font-bold">
          {nombreMes(vista.mes)} {vista.anio}
        </p>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={enMesActual}
          onClick={() => alMover(1)}
          className={navegar}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {iniciales.map((letra, i) => (
          <span key={i} aria-hidden className="py-1 text-[10px] font-semibold text-texto-3">
            {letra}
          </span>
        ))}
        {celdasDelMes(vista.anio, vista.mes).map((fecha, i) =>
          fecha === null ? (
            <span key={`hueco-${i}`} />
          ) : (
            <button
              key={fecha}
              type="button"
              disabled={fecha > hoy}
              aria-pressed={fecha === valor}
              aria-label={fechaLarga(fecha)}
              onClick={() => alElegir(fecha)}
              className={`tabular mx-auto grid size-9 place-items-center rounded-full text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                fecha === valor
                  ? "bg-palido text-palido-texto"
                  : fecha === hoy
                    ? "text-enlace ring-1 ring-inset ring-enlace enabled:hover:bg-tarjeta-hover"
                    : "text-texto enabled:hover:bg-tarjeta-hover"
              }`}
            >
              {Number(fecha.slice(8))}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
