"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import {
  type Mes,
  celdasDelMes,
  diaAnterior,
  etiquetaFecha,
  fechaLarga,
  mesDe,
  moverMes,
  nombreMes,
} from "@/lib/fechas";
import { pildoraElegida, pildoraNormal, pildoraOpcion } from "./formulario";

const iniciales = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Fecha de un movimiento: píldoras "Hoy" y "Ayer" y un calendario propio para cualquier otro día, con los
 * tokens de la app en vez del selector del navegador, que no se puede estilizar. No deja elegir días futuros.
 * La fecha viaja en un campo oculto. Sin JavaScript, un campo de fecha nativo dentro de <noscript> va antes
 * con el mismo nombre, así que es el que lee el servidor.
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
  const id = useId();
  const ayer = diaAnterior(hoy);
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Mes>(() => mesDe(valor));
  const otra = valor !== hoy && valor !== ayer;

  const elegir = (fecha: string) => {
    onCambio(fecha);
    setAbierto(false);
  };
  const estilo = (elegida: boolean) => `${pildoraOpcion} ${elegida ? pildoraElegida : pildoraNormal}`;

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-semibold text-texto-3">Fecha</legend>
      <noscript>
        <input
          type="date"
          name={name}
          defaultValue={valor}
          max={hoy}
          aria-label="Fecha"
          className="h-12 w-full rounded-[14px] border border-tarjeta-borde bg-tarjeta-hover px-4 text-[15px] text-texto"
        />
      </noscript>
      <input type="hidden" name={name} value={valor} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={valor === hoy}
          onClick={() => elegir(hoy)}
          className={estilo(valor === hoy)}
        >
          Hoy
        </button>
        <button
          type="button"
          aria-pressed={valor === ayer}
          onClick={() => elegir(ayer)}
          className={estilo(valor === ayer)}
        >
          Ayer
        </button>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={id}
          aria-label={otra ? `Otra fecha: ${fechaLarga(valor)}` : "Otra fecha"}
          onClick={() => {
            setVista(mesDe(valor));
            setAbierto(!abierto);
          }}
          className={estilo(otra)}
        >
          <CalendarDays size={16} aria-hidden />
          {otra ? etiquetaFecha(valor) : "Otra fecha"}
        </button>
      </div>

      {abierto ? (
        <Calendario
          id={id}
          vista={vista}
          alMover={(delta) => setVista((v) => moverMes(v, delta))}
          valor={valor}
          hoy={hoy}
          alElegir={elegir}
          alCerrar={() => setAbierto(false)}
        />
      ) : null}

      {error ? (
        <span role="alert" className="text-[12px] font-semibold text-negativo">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

/** Un mes en cuadrícula de lunes a domingo. El hoy va marcado; lo elegido, en menta; lo futuro, apagado. */
function Calendario({
  id,
  vista,
  alMover,
  valor,
  hoy,
  alElegir,
  alCerrar,
}: {
  id: string;
  vista: Mes;
  alMover: (delta: number) => void;
  valor: string;
  hoy: string;
  alElegir: (fecha: string) => void;
  alCerrar: () => void;
}) {
  const actual = mesDe(hoy);
  const enMesActual = vista.anio === actual.anio && vista.mes === actual.mes;
  const navegar =
    "grid size-9 place-items-center rounded-full bg-tarjeta text-texto-2 enabled:hover:text-texto disabled:opacity-30";

  return (
    <div
      id={id}
      onKeyDown={(e) => {
        if (e.key === "Escape") alCerrar();
      }}
      className="rounded-[18px] border border-tarjeta-borde bg-tarjeta-hover p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" aria-label="Mes anterior" onClick={() => alMover(-1)} className={navegar}>
          <ChevronLeft size={18} aria-hidden />
        </button>
        <p aria-live="polite" className="text-[14px] font-bold text-texto">
          {nombreMes(vista.mes)} {vista.anio}
        </p>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={enMesActual}
          onClick={() => alMover(1)}
          className={navegar}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {iniciales.map((letra, i) => (
          <span key={i} aria-hidden className="py-1 text-[11px] font-semibold text-texto-3">
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
              className={`tabular mx-auto grid size-10 place-items-center rounded-full text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                fecha === valor
                  ? "bg-palido text-palido-texto"
                  : fecha === hoy
                    ? "text-enlace ring-1 ring-inset ring-enlace enabled:hover:bg-tarjeta"
                    : "text-texto enabled:hover:bg-tarjeta"
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
