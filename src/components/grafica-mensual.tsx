"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ResumenMes } from "@/db/consultas";
import { formatearCentavos, formatearEnteros } from "@/lib/dinero";

/*
  Columnas apiladas por mes, como la gráfica de la referencia: lo gastado en azul pálido abajo
  y lo ahorrado (ingresos − gastos) en azul arriba, eje de valores a la derecha.
  El SVG mide el ancho real del contenedor para que el texto no se escale con la tarjeta.
  Reglas del método de visualización que se mantienen: una sola escala, extremo redondeado y base
  recta, 2 px de separación entre segmentos, rejilla recesiva, leyenda por haber dos series,
  tooltip por columna y tabla equivalente.
*/

const nombresMes = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function etiquetaMes(clave: string) {
  const [, mes] = clave.split("-");
  return nombresMes[Number(mes) - 1];
}

function topeLimpio(maximo: number) {
  if (maximo <= 0) return 100_00;
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  for (const p of [1, 2, 2.5, 5, 10]) {
    const candidato = p * magnitud;
    if (candidato >= maximo) return candidato;
  }
  return 10 * magnitud;
}

function etiquetaEje(centavos: number) {
  const dolares = centavos / 100;
  if (dolares >= 1000) return `${(dolares / 1000).toLocaleString("es-VE", { maximumFractionDigits: 1 })}k`;
  return formatearEnteros(centavos);
}

/** Ancho real del elemento, actualizado al redimensionar. Antes de medir usa el valor inicial. */
function useAncho<T extends HTMLElement>(inicial: number) {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observador = new ResizeObserver((entradas) => {
      const w = Math.round(entradas[0]?.contentRect.width ?? inicial);
      if (w > 0) setAncho(w);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [inicial]);
  return { ref, ancho };
}

export function GraficaMensual({ datos }: { datos: ResumenMes[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const idTabla = useId();
  const { ref, ancho } = useAncho<HTMLDivElement>(360);

  const alto = ancho >= 560 ? 230 : 190;
  const margen = { arriba: 10, derecha: 46, abajo: 26, izquierda: 6 };
  const anchoUtil = ancho - margen.izquierda - margen.derecha;
  const altoUtil = alto - margen.arriba - margen.abajo;

  const series = datos.map((d) => ({ ...d, ahorroCentavos: Math.max(d.ingresosCentavos - d.gastosCentavos, 0) }));
  const maximo = Math.max(...series.map((s) => Math.max(s.ingresosCentavos, s.gastosCentavos)), 0);
  const tope = topeLimpio(maximo);
  const escala = (v: number) => (v / tope) * altoUtil;

  const banda = anchoUtil / series.length;
  const anchoColumna = Math.min(28, banda * 0.55);
  const separacion = 2;
  const hayDatos = maximo > 0;
  const base = margen.arriba + altoUtil;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * tope);

  const tapaRedonda = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(6, h, w / 2);
    return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[12px] font-semibold text-texto-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[3px] bg-serie-a" />
          Gastado
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[3px] bg-serie-b" />
          Ahorrado
        </span>
      </div>

      <div className="relative" ref={ref}>
        <svg
          width={ancho}
          height={alto}
          viewBox={`0 0 ${ancho} ${alto}`}
          className="block max-w-full"
          role="img"
          aria-label="Ingresos y gastos por mes"
          aria-describedby={idTabla}
          onPointerLeave={() => setActivo(null)}
        >
          {ticks.map((t) => {
            const y = base - escala(t);
            return (
              <g key={t}>
                <line
                  x1={margen.izquierda}
                  x2={ancho - margen.derecha}
                  y1={y}
                  y2={y}
                  className="stroke-rejilla"
                  strokeWidth={1}
                />
                <text x={ancho - margen.derecha + 8} y={y + 3.5} className="fill-texto-3 text-[11px] font-semibold">
                  {etiquetaEje(t)}
                </text>
              </g>
            );
          })}

          {series.map((s, i) => {
            const centro = margen.izquierda + banda * i + banda / 2;
            const x = centro - anchoColumna / 2;
            const altoGasto = escala(s.gastosCentavos);
            const altoAhorro = escala(s.ahorroCentavos);
            const hayGasto = altoGasto > 0;
            const hayAhorro = altoAhorro > 0;
            const yGasto = base - altoGasto;
            const yAhorro = yGasto - (hayGasto && hayAhorro ? separacion : 0) - altoAhorro;
            const activa = activo === i;
            return (
              <g
                key={s.mes}
                opacity={activo === null || activa ? 1 : 0.5}
                onPointerEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                tabIndex={0}
                aria-label={`${etiquetaMes(s.mes)}: gastado ${formatearCentavos(s.gastosCentavos)}, ahorrado ${formatearCentavos(s.ahorroCentavos)}`}
              >
                <rect
                  x={margen.izquierda + banda * i}
                  y={margen.arriba}
                  width={banda}
                  height={altoUtil}
                  fill="transparent"
                />
                {hayGasto ? (
                  hayAhorro ? (
                    <rect x={x} y={yGasto} width={anchoColumna} height={altoGasto} className="fill-serie-a" />
                  ) : (
                    <path d={tapaRedonda(x, yGasto, anchoColumna, altoGasto)} className="fill-serie-a" />
                  )
                ) : null}
                {hayAhorro ? (
                  <path d={tapaRedonda(x, yAhorro, anchoColumna, altoAhorro)} className="fill-serie-b" />
                ) : null}
                <text
                  x={centro}
                  y={alto - 8}
                  textAnchor="middle"
                  className={`text-[11px] font-semibold ${activa ? "fill-texto" : "fill-texto-3"}`}
                >
                  {etiquetaMes(s.mes)}
                </text>
              </g>
            );
          })}

          {!hayDatos ? (
            <text
              x={margen.izquierda + anchoUtil / 2}
              y={margen.arriba + altoUtil / 2}
              textAnchor="middle"
              className="fill-texto-3 text-[12px]"
            >
              Sin movimientos todavía
            </text>
          ) : null}
        </svg>

        {activo !== null ? (
          <div
            role="status"
            className="tarjeta pointer-events-none absolute left-1/2 top-0 w-max max-w-full -translate-x-1/2 rounded-[14px] px-3 py-2 text-[12px] shadow-tarjeta"
          >
            <div className="mb-1 font-bold text-texto">{etiquetaMes(series[activo].mes)}</div>
            <FilaTooltip color="bg-serie-a" nombre="Gastado" valor={series[activo].gastosCentavos} />
            <FilaTooltip color="bg-serie-b" nombre="Ahorrado" valor={series[activo].ahorroCentavos} />
            <FilaTooltip nombre="Ingresos" valor={series[activo].ingresosCentavos} />
          </div>
        ) : null}
      </div>

      <details className="mt-2 text-[12px] text-texto-3">
        <summary className="cursor-pointer select-none font-semibold hover:text-texto-2">Ver tabla</summary>
        <table id={idTabla} className="tabular mt-2 w-full text-left text-texto-2">
          <thead>
            <tr className="text-texto-3">
              <th className="py-1 font-semibold">Mes</th>
              <th className="py-1 text-right font-semibold">Ingresos</th>
              <th className="py-1 text-right font-semibold">Gastado</th>
              <th className="py-1 text-right font-semibold">Ahorrado</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.mes} className="border-t border-tarjeta-borde">
                <td className="py-1">{etiquetaMes(s.mes)}</td>
                <td className="py-1 text-right">{formatearCentavos(s.ingresosCentavos)}</td>
                <td className="py-1 text-right">{formatearCentavos(s.gastosCentavos)}</td>
                <td className="py-1 text-right">{formatearCentavos(s.ahorroCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function FilaTooltip({ color, nombre, valor }: { color?: string; nombre: string; valor: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-texto-3">
        {color ? (
          <span aria-hidden className={`inline-block h-0.5 w-3 rounded-full ${color}`} />
        ) : (
          <span className="inline-block w-3" />
        )}
        {nombre}
      </span>
      <span className="tabular font-bold text-texto">{formatearCentavos(valor)}</span>
    </div>
  );
}
