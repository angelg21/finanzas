"use client";

import { useId, useState } from "react";
import { formatearCentavos, formatearEnteros } from "@/lib/dinero";

/*
  Anillo de distribución sobre la tarjeta menta: segmentos gruesos separados por un contorno
  blanco, total en el centro y leyenda con valores. Cinco tonos de la paleta que se distinguen
  entre sí: pino profundo, verde medio, blanco, salvia gris y rayado de pino sobre blanco.
  El color sigue a la entidad (tipo de sobre), no a su tamaño.
*/

export type SegmentoDona = { clave: string; nombre: string; valorCentavos: number; paso: 1 | 2 | 3 | 4 | 5 | 6 };

const clasePaso: Record<Exclude<SegmentoDona["paso"], 5 | 6>, { relleno: string; fondo: string }> = {
  1: { relleno: "fill-dona-1", fondo: "bg-dona-1" },
  2: { relleno: "fill-dona-2", fondo: "bg-dona-2" },
  3: { relleno: "fill-dona-3", fondo: "bg-dona-3" },
  4: { relleno: "fill-dona-4", fondo: "bg-dona-4" },
};

/** El paso 5 es blanco con rayas diagonales y el 6 blanco con puntos, ambos del color dona-5. */
const rayasCss = "repeating-linear-gradient(45deg, var(--dona-5) 0 1.5px, #ffffff 1.5px 5px)";
const puntosCss = "radial-gradient(var(--dona-5) 0.9px, #ffffff 1.1px)";
const esPatron = (paso: SegmentoDona["paso"]): paso is 5 | 6 => paso === 5 || paso === 6;

function sector(cx: number, cy: number, rExt: number, rInt: number, a0: number, a1: number) {
  const barrido = Math.min(a1 - a0, Math.PI * 2 - 0.0001);
  const fin = a0 + barrido;
  const grande = barrido > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  const [x0, y0] = p(rExt, a0);
  const [x1, y1] = p(rExt, fin);
  const [x2, y2] = p(rInt, fin);
  const [x3, y3] = p(rInt, a0);
  return `M${x0},${y0} A${rExt},${rExt} 0 ${grande} 1 ${x1},${y1} L${x2},${y2} A${rInt},${rInt} 0 ${grande} 0 ${x3},${y3} Z`;
}

export function GraficaDona({ segmentos, titulo }: { segmentos: SegmentoDona[]; titulo: string }) {
  const [activo, setActivo] = useState<string | null>(null);
  const idTabla = useId();
  const idRayas = useId();
  const idPuntos = useId();

  const visibles = segmentos.filter((s) => s.valorCentavos > 0);
  const total = visibles.reduce((a, s) => a + s.valorCentavos, 0);

  const tam = 240;
  const cx = tam / 2;
  const cy = tam / 2;
  const rExt = 112;
  const rInt = 74;

  // Cada segmento arranca donde terminó la suma de los anteriores; empieza arriba (−90°).
  const arcos = visibles.map((s, i) => {
    const previo = visibles.slice(0, i).reduce((acc, x) => acc + x.valorCentavos, 0);
    const a0 = -Math.PI / 2 + (previo / total) * Math.PI * 2;
    const a1 = a0 + (s.valorCentavos / total) * Math.PI * 2;
    return { ...s, d: sector(cx, cy, rExt, rInt, a0, a1) };
  });

  const seleccionado = arcos.find((s) => s.clave === activo) ?? null;

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:gap-5">
      <div className="relative w-full max-w-[230px] shrink-0 lg:w-[200px] xl:w-[220px]">
        <svg
          viewBox={`0 0 ${tam} ${tam}`}
          className="block h-auto w-full"
          role="img"
          aria-label={titulo}
          aria-describedby={idTabla}
          onPointerLeave={() => setActivo(null)}
        >
          <defs>
            <pattern id={idRayas} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#ffffff" />
              <line x1="0" y1="0" x2="0" y2="6" className="stroke-dona-5" strokeWidth={2} />
            </pattern>
            <pattern id={idPuntos} patternUnits="userSpaceOnUse" width="6" height="6">
              <rect width="6" height="6" fill="#ffffff" />
              <circle cx="3" cy="3" r="1.3" className="fill-dona-5" />
            </pattern>
          </defs>

          {total === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={(rExt + rInt) / 2}
              fill="none"
              strokeWidth={rExt - rInt}
              className="stroke-palida-pista"
            />
          ) : (
            arcos.map((s) => {
              const activa = activo === s.clave;
              const relleno = esPatron(s.paso) ? undefined : clasePaso[s.paso].relleno;
              const patron = s.paso === 5 ? `url(#${idRayas})` : s.paso === 6 ? `url(#${idPuntos})` : undefined;
              return (
                <path
                  key={s.clave}
                  d={s.d}
                  fill={patron}
                  className={`${relleno ?? ""} stroke-white`}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={activo === null || activa ? 1 : 0.55}
                  onPointerEnter={() => setActivo(s.clave)}
                  onFocus={() => setActivo(s.clave)}
                  onBlur={() => setActivo(null)}
                  tabIndex={0}
                  aria-label={`${s.nombre}: ${formatearCentavos(s.valorCentavos)}, ${Math.round((s.valorCentavos / total) * 100)} %`}
                />
              );
            })
          )}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-palida-texto text-[30px] font-extrabold tracking-tight"
          >
            {seleccionado ? formatearEnteros(seleccionado.valorCentavos) : formatearEnteros(total)}
          </text>
          <text x={cx} y={cy + 18} textAnchor="middle" className="fill-palida-texto-2 text-[11px] font-bold">
            {seleccionado ? seleccionado.nombre.toUpperCase() : "USD EN SOBRES"}
          </text>
        </svg>
      </div>

      {/* Leyenda en dos líneas por sobre: nombre arriba, monto y porcentaje abajo. */}
      <ul
        className="grid w-full min-w-0 grid-cols-2 gap-x-4 gap-y-2.5 lg:flex-1 lg:grid-cols-1 lg:gap-y-2"
        id={idTabla}
      >
        {segmentos.map((s) => {
          const porcentaje = total > 0 ? Math.round((s.valorCentavos / total) * 100) : 0;
          const activa = activo === s.clave;
          return (
            <li
              key={s.clave}
              className={`flex items-start gap-2 text-[12px] ${activa ? "opacity-100" : "opacity-90"}`}
              onPointerEnter={() => setActivo(s.clave)}
              onPointerLeave={() => setActivo(null)}
            >
              <span
                aria-hidden
                className={`mt-1 inline-block size-3 shrink-0 rounded-[3px] border border-white/70 ${esPatron(s.paso) ? "" : clasePaso[s.paso].fondo}`}
                style={
                  s.paso === 5
                    ? { backgroundImage: rayasCss }
                    : s.paso === 6
                      ? { backgroundImage: puntosCss, backgroundSize: "4px 4px" }
                      : undefined
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-palida-texto">{s.nombre}</span>
                <span className="tabular block text-palida-texto-2">
                  <span className="font-bold text-palida-texto">{formatearCentavos(s.valorCentavos)}</span> ·{" "}
                  {porcentaje} %
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
