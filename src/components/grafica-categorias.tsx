"use client";

import Link from "next/link";
import { type ReactNode, useId, useState } from "react";
import { colorPorDefecto, coloresCategoria } from "@/lib/categorias";
import { formatearCentavos, partesCentavos } from "@/lib/dinero";
import { sector } from "./grafica-dona";
import { fondoDe } from "./iconos-categoria";

/*
  Anillo de /movimientos (spec 003): el total del periodo repartido por categoría, cada porción del color de su
  categoría y separada por 2 px del color de la tarjeta. Debajo, la leyenda de mayor a menor con monto y porcentaje;
  cada entrada es un enlace que filtra la lista, y la primera es "Todas". Con JavaScript, la porción se resalta al
  pasar o tocar, como en `GraficaDona`. El color no es la única pista: la leyenda repite nombre y monto.
*/

export type PorcionGrafica = {
  clave: string;
  nombre: string;
  color: string;
  centavos: number;
  porcentaje: number;
  menosDeUno: boolean;
  href: string;
};

/** El token del color de la paleta; uno desconocido cae en el de por defecto, como en `fondoDe`. */
function rellenoDe(color: string) {
  const conocido = (coloresCategoria as readonly string[]).includes(color) ? color : colorPorDefecto;
  return `var(--cat-${conocido})`;
}

const textoPorcentaje = (p: PorcionGrafica) => (p.menosDeUno ? "<1 %" : `${p.porcentaje} %`);

/** El nombre en el centro del anillo cabe en el hueco hasta unos 20 caracteres; más largo, se corta con "…". */
const nombreEnElCentro = (nombre: string) =>
  nombre.length > 20 ? `${nombre.slice(0, 19).trimEnd()}…`.toUpperCase() : nombre.toUpperCase();

export function GraficaCategorias({
  porciones,
  total,
  etiquetaCentro,
  titulo,
  elegida,
  hrefTodas,
}: {
  porciones: PorcionGrafica[];
  total: number;
  etiquetaCentro: string;
  titulo: string;
  elegida: string | null;
  hrefTodas: string;
}) {
  const [activa, setActiva] = useState<string | null>(null);
  const idLeyenda = useId();

  const tam = 240;
  const centro = tam / 2;
  const rExt = 112;
  const rInt = 76;

  // Cada porción arranca donde terminó la suma de las anteriores; empieza arriba (−90°).
  let acumulado = 0;
  const arcos = porciones.map((p) => {
    const a0 = -Math.PI / 2 + (acumulado / total) * Math.PI * 2;
    acumulado += p.centavos;
    const a1 = -Math.PI / 2 + (acumulado / total) * Math.PI * 2;
    return { ...p, d: sector(centro, centro, rExt, rInt, a0, a1) };
  });

  const resaltada = porciones.find((p) => p.clave === activa) ?? null;
  const cifra = partesCentavos(resaltada ? resaltada.centavos : total);
  const textoCifra = `${cifra.entero},${cifra.decimales}`;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-full max-w-[240px]">
        <svg
          viewBox={`0 0 ${tam} ${tam}`}
          className="block h-auto w-full"
          role="img"
          aria-label={titulo}
          aria-describedby={idLeyenda}
          onPointerLeave={() => setActiva(null)}
        >
          {total === 0 ? (
            <circle
              cx={centro}
              cy={centro}
              r={(rExt + rInt) / 2}
              fill="none"
              strokeWidth={rExt - rInt}
              className="stroke-pildora-oscura"
            />
          ) : (
            arcos.map((p) => {
              const apagada = (elegida !== null && elegida !== p.clave) || (activa !== null && activa !== p.clave);
              return (
                <path
                  key={p.clave}
                  d={p.d}
                  style={{ fill: rellenoDe(p.color) }}
                  className="stroke-tarjeta transition-opacity"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={apagada ? 0.35 : 1}
                  onPointerEnter={() => setActiva(p.clave)}
                  onFocus={() => setActiva(p.clave)}
                  onBlur={() => setActiva(null)}
                  tabIndex={0}
                  aria-label={`${p.nombre}: ${formatearCentavos(p.centavos)}, ${textoPorcentaje(p)}`}
                />
              );
            })
          )}
          <text
            x={centro}
            y={centro + 2}
            textAnchor="middle"
            className={`fill-texto font-extrabold tracking-tight ${textoCifra.length > 8 ? "text-[22px]" : "text-[28px]"}`}
          >
            {textoCifra}
          </text>
          <text x={centro} y={centro + 22} textAnchor="middle" className="fill-texto-3 text-[11px] font-bold">
            {resaltada ? nombreEnElCentro(resaltada.nombre) : etiquetaCentro}
          </text>
        </svg>
      </div>

      <ul id={idLeyenda} className="grid w-full grid-cols-2 gap-1.5">
        <li className="col-span-2">
          <EntradaLeyenda
            href={hrefTodas}
            elegida={elegida === null}
            nombre="Todas"
            detalle={formatearCentavos(total)}
          />
        </li>
        {porciones.map((p) => (
          <li key={p.clave} onPointerEnter={() => setActiva(p.clave)} onPointerLeave={() => setActiva(null)}>
            <EntradaLeyenda
              href={p.href}
              elegida={elegida === p.clave}
              nombre={p.nombre}
              detalle={
                // El porcentaje no se parte: entre 1024 y 1100 px "70" y "%" quedaban en dos líneas.
                <>
                  {`${formatearCentavos(p.centavos)} · `}
                  <span className="whitespace-nowrap">{textoPorcentaje(p)}</span>
                </>
              }
              punto={fondoDe(p.color)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntradaLeyenda({
  href,
  elegida,
  nombre,
  detalle,
  punto,
}: {
  href: string;
  elegida: boolean;
  nombre: string;
  detalle: ReactNode;
  punto?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={elegida ? "true" : undefined}
      className={`flex items-start gap-2 rounded-[12px] px-2.5 py-2 text-[12px] ${
        elegida ? "bg-palido text-palido-texto" : "text-texto hover:bg-tarjeta-hover"
      }`}
    >
      {punto ? <span aria-hidden className={`mt-0.5 size-3 shrink-0 rounded-full ${punto}`} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{nombre}</span>
        <span className={`tabular block ${elegida ? "text-palido-texto" : "text-texto-3"}`}>{detalle}</span>
      </span>
    </Link>
  );
}
