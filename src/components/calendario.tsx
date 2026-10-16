"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
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
 *
 * La variante `futura` es para una fecha prevista (spec 005): píldoras "Sin fecha", que envía "", y "Elegir fecha".
 * Su calendario deja ir a meses futuros y apaga los días pasados sin prohibirlos: una deuda ya vencida también se
 * registra. Sin JavaScript, el campo nativo sin tope.
 */
export function SelectorFecha({
  name,
  valor,
  hoy,
  onCambio,
  error,
  variante = "pasada",
  etiqueta = "Fecha",
}: {
  name: string;
  valor: string;
  hoy: string;
  onCambio: (fecha: string) => void;
  error?: string;
  variante?: "pasada" | "futura";
  etiqueta?: string;
}) {
  const ventana = useRef<HTMLDialogElement>(null);
  // El día que representa el valor, para pintarlo; vacío si llegó algo que no es una fecha (sin JavaScript).
  const resuelta = fechaDesdeAtajo(valor, hoy);
  const dia = esFecha(resuelta) ? resuelta : "";
  const [vista, setVista] = useState<Mes>(() => mesDe(dia || hoy));
  const futura = variante === "futura";
  const otra = futura ? dia !== "" : valor !== "hoy" && valor !== "ayer" && dia !== "";
  // Una fecha prevista puede caer en otro año: entonces lleva el año.
  const otroAnio = futura && dia !== "" && dia.slice(0, 4) !== hoy.slice(0, 4);
  const etiquetaDia = dia ? `${etiquetaFecha(dia)}${otroAnio ? ` ${dia.slice(0, 4)}` : ""}` : "";
  const textoOtra = futura ? "Elegir fecha" : "Otra fecha";

  const elegir = (fecha: string) => {
    onCambio(fecha);
    ventana.current?.close();
  };
  const estilo = (elegida: boolean) => `${pildoraOpcion} ${elegida ? pildoraElegida : pildoraNormal}`;

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-semibold text-texto-3">{etiqueta}</legend>
      <noscript>
        <input
          type="date"
          name={name}
          defaultValue={dia}
          max={futura ? undefined : hoy}
          aria-label={etiqueta}
          className="h-12 w-full rounded-[14px] border border-tarjeta-borde bg-tarjeta-hover px-4 text-[16px] text-texto lg:text-[15px]"
        />
      </noscript>
      <input type="hidden" name={name} value={valor} />

      <div className="flex flex-wrap gap-2 noscript:hidden">
        {futura ? (
          <button type="button" aria-pressed={!otra} onClick={() => elegir("")} className={estilo(!otra)}>
            Sin fecha
          </button>
        ) : (
          <>
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
          </>
        )}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={otra ? `${textoOtra}: ${fechaLarga(dia)}` : textoOtra}
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
          {otra ? etiquetaDia : textoOtra}
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
          futura={futura}
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

/**
 * Saltar a un día con el mismo calendario (spec 003, criterio 17): el botón muestra `children` (el periodo) con el
 * icono de calendario y abre la ventana; al elegir un día navega a `destino` con `fecha` puesta. Quien lo usa decide
 * el resto de la dirección. Sin JavaScript el botón no hace nada: la página pone un campo de fecha en <noscript>.
 */
export function BotonCalendario({
  destino,
  elegida,
  inicio,
  hoy,
  children,
}: {
  destino: string;
  /** El día marcado en menta, o "" si el periodo no es un día. */
  elegida: string;
  /** El día cuyo mes se muestra al abrir. */
  inicio: string;
  hoy: string;
  children: ReactNode;
}) {
  const ventana = useRef<HTMLDialogElement>(null);
  const [vista, setVista] = useState<Mes>(() => mesDe(inicio));
  const router = useRouter();

  const elegir = (fecha: string) => {
    ventana.current?.close();
    const url = new URL(destino, window.location.origin);
    url.searchParams.set("fecha", fecha);
    router.push(`${url.pathname}${url.search}`);
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="Elegir un día en el calendario"
        onClick={() => {
          setVista(mesDe(inicio));
          ventana.current?.showModal();
        }}
        className="flex items-center gap-2 rounded-full px-3 py-2 text-[15px] font-bold hover:bg-tarjeta-hover"
      >
        <CalendarDays size={18} className="text-texto-3" aria-hidden />
        {children}
      </button>
      <dialog
        ref={ventana}
        aria-label="Elegir un día"
        onClick={(e) => {
          if (e.target === e.currentTarget) ventana.current?.close();
        }}
        className="m-auto w-[300px] max-w-[calc(100vw-32px)] rounded-[20px] border border-tarjeta-borde bg-tarjeta p-0 text-texto shadow-panel backdrop:bg-velo"
      >
        <Calendario
          vista={vista}
          alMover={(delta) => setVista((v) => moverMes(v, delta))}
          valor={elegida}
          hoy={hoy}
          alElegir={elegir}
        />
      </dialog>
    </>
  );
}

/**
 * Un mes en cuadrícula de lunes a domingo. El hoy va con anillo; lo elegido, en menta; lo futuro, apagado y sin
 * elegir. Con `futura` es al revés: lo pasado se apaga, pero se puede elegir, y se avanza a meses futuros.
 */
function Calendario({
  vista,
  alMover,
  valor,
  hoy,
  alElegir,
  futura = false,
}: {
  vista: Mes;
  alMover: (delta: number) => void;
  valor: string;
  hoy: string;
  alElegir: (fecha: string) => void;
  futura?: boolean;
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
          disabled={enMesActual && !futura}
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
              disabled={!futura && fecha > hoy}
              aria-pressed={fecha === valor}
              aria-label={fechaLarga(fecha)}
              onClick={() => alElegir(fecha)}
              className={`tabular mx-auto grid size-9 place-items-center rounded-full text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                fecha === valor
                  ? "bg-palido text-palido-texto"
                  : fecha === hoy
                    ? "text-enlace ring-1 ring-inset ring-enlace enabled:hover:bg-tarjeta-hover"
                    : futura && fecha < hoy
                      ? "text-texto opacity-30 hover:bg-tarjeta-hover hover:opacity-60"
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
