import {
  Gift,
  HandCoins,
  HeartHandshake,
  Inbox,
  type LucideIcon,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  Target,
} from "lucide-react";
import { createElement } from "react";
import type { Sobre } from "@/db/schema";
import { type NivelDeSobre, type PasoDeSobre, pasoDeSobre } from "@/lib/sobres";

/*
  El icono de un sobre: una funda con una muesca arriba, como la tarjeta de la referencia de colores, que se llena
  desde abajo según su saldo (src/lib/sobres.ts). Es otra figura que la de las categorías (círculo de color con el
  icono en blanco) a propósito: un sobre se reconoce de un vistazo. El color es el de su porción en el anillo de
  Sobres, y el icono, uno de línea por tipo; nunca emojis. Donde el relleno cruza el icono, el icono cambia de color
  para leerse sobre los dos fondos. Sin hooks: sirve igual en páginas de servidor y en formularios de cliente.
*/

const iconoPorTipo: Record<Sobre["tipo"], LucideIcon> = {
  por_asignar: Inbox,
  gastos: ShoppingBasket,
  familia: HeartHandshake,
  emergencia: ShieldCheck,
  meta: Target,
  fondo: Gift,
  inversion: Sprout,
  deudas: HandCoins,
};

/** El relleno de cada tono del anillo y el color del icono sobre él; rayas y puntos llevan un halo blanco. */
const tonos: Record<PasoDeSobre, { relleno: string; icono: string; patron?: "rayas" | "puntos" }> = {
  1: { relleno: "fill-dona-1", icono: "text-white" },
  2: { relleno: "fill-dona-2", icono: "text-dona-1" },
  3: { relleno: "fill-dona-3", icono: "text-dona-5" },
  4: { relleno: "fill-dona-4", icono: "text-white" },
  5: { relleno: "", icono: "text-dona-5", patron: "rayas" },
  6: { relleno: "", icono: "text-dona-5", patron: "puntos" },
};

const lados = { sm: "size-8", md: "size-11", lg: "size-14" } as const;

/**
 * Lo que no es del tono del sobre sigue a la superficie donde está: sobre una tarjeta (o el hero), los tokens del
 * tema; sobre la tarjeta menta, que es igual en los dos temas, los suyos.
 */
const superficies = {
  tarjeta: { vacio: "fill-pildora-oscura", trazo: "stroke-texto-3", icono: "text-texto-2", aro: "stroke-tarjeta" },
  palida: {
    vacio: "fill-palida-pista",
    trazo: "stroke-palida-texto-2",
    icono: "text-palida-texto-2",
    aro: "stroke-palido",
  },
} as const;

// La figura, en un lienzo de 48: cuerpo de 40 × 34 con esquinas de 9 y una muesca de radio 5 en el centro de arriba.
const [izq, der, arriba, abajo, radio, muesca, centro] = [4, 44, 8, 42, 9, 5, 24];
const figura = [
  `M${izq + radio},${arriba}`,
  `H${centro - muesca}`,
  `A${muesca},${muesca} 0 0 0 ${centro + muesca},${arriba}`,
  `H${der - radio}`,
  `A${radio},${radio} 0 0 1 ${der},${arriba + radio}`,
  `V${abajo - radio}`,
  `A${radio},${radio} 0 0 1 ${der - radio},${abajo}`,
  `H${izq + radio}`,
  `A${radio},${radio} 0 0 1 ${izq},${abajo - radio}`,
  `V${arriba + radio}`,
  `A${radio},${radio} 0 0 1 ${izq + radio},${arriba}`,
  "Z",
].join(" ");
/** La solapa: una V tenue desde las esquinas de arriba. */
const solapa = `M${izq + 5},${arriba + 4} L${centro},${arriba + 13} L${der - 5},${arriba + 4}`;
const icono = { x: 15, y: 20, lado: 18 };
/** Altura de la onda del borde del relleno, como un líquido. */
const onda = 1.4;

/** Lo lleno, desde la línea `y` hacia abajo, con el borde en onda. */
const lleno = (y: number) => `M0,${y} Q6,${y - onda} 12,${y} T24,${y} T36,${y} T48,${y} V48 H0 Z`;
/** Lo vacío, de arriba hasta la misma onda recorrida al revés, para que el icono cambie de color justo en el borde. */
const vacio = (y: number) => `M0,0 H48 V${y} Q42,${y + onda} 36,${y} T24,${y} T12,${y} T0,${y} Z`;

export function IconoSobre({
  clave,
  tipo,
  nivel,
  tamano = "md",
  superficie = "tarjeta",
  className = "",
}: {
  /** Único en la página, para los ids del SVG: el id del sobre basta. */
  clave: number | string;
  tipo: string;
  nivel: NivelDeSobre;
  tamano?: keyof typeof lados;
  /** Dónde va: sobre una tarjeta o el hero, o sobre la tarjeta menta (el reparto). */
  superficie?: keyof typeof superficies;
  className?: string;
}) {
  const id = `sobre-${clave}-${tamano}`;
  const tono = tonos[pasoDeSobre(tipo)];
  const fondo = superficies[superficie];
  const Icono = (iconoPorTipo as Partial<Record<string, LucideIcon>>)[tipo] ?? Target;
  // Sin medida, lleno de su color; con ella, hasta su porcentaje. Lleno del todo, la onda queda fuera del cuerpo;
  // vacío, no hay relleno que asome por debajo.
  const porcentaje = nivel.porcentaje ?? 100;
  const borde =
    porcentaje >= 100 ? arriba - 2 * onda : porcentaje <= 0 ? 48 : abajo - ((abajo - arriba) * porcentaje) / 100;
  const dibujo = (clase: string, ancho = 2) =>
    createElement(Icono, {
      x: icono.x,
      y: icono.y,
      size: icono.lado,
      strokeWidth: ancho,
      className: clase,
      "aria-hidden": true,
    });

  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`shrink-0 ${lados[tamano]} ${className}`}>
      <defs>
        <clipPath id={`${id}-cuerpo`}>
          <path d={figura} />
        </clipPath>
        <clipPath id={`${id}-lleno`}>
          <path d={lleno(borde)} />
        </clipPath>
        <clipPath id={`${id}-vacio`}>
          <path d={vacio(borde)} />
        </clipPath>
        {tono.patron === "rayas" ? (
          <pattern id={`${id}-rayas`} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <rect width="5" height="5" className="fill-dona-3" />
            <line x1="0" y1="0" x2="0" y2="5" className="stroke-dona-5" strokeWidth={1.6} />
          </pattern>
        ) : tono.patron === "puntos" ? (
          <pattern id={`${id}-puntos`} patternUnits="userSpaceOnUse" width="5" height="5">
            <rect width="5" height="5" className="fill-dona-3" />
            <circle cx="2.5" cy="2.5" r="1.1" className="fill-dona-5" />
          </pattern>
        ) : null}
      </defs>

      {/* Lo vacío, en un gris verdoso que se distingue del blanco de un sobre lleno (Planes). */}
      <path d={figura} className={fondo.vacio} />
      <g clipPath={`url(#${id}-cuerpo)`}>
        <path d={lleno(borde)} className={tono.relleno} fill={tono.patron ? `url(#${id}-${tono.patron})` : undefined} />
      </g>
      <path d={solapa} fill="none" className={fondo.trazo} strokeWidth={1.2} strokeLinejoin="round" opacity={0.45} />
      {/* El contorno: fino; punteado si el sobre está vacío; rojo si está en negativo. */}
      <path
        d={figura}
        fill="none"
        className={nivel.negativo ? "stroke-negativo" : fondo.trazo}
        strokeWidth={nivel.negativo ? 2.2 : 1.1}
        strokeDasharray={porcentaje <= 0 && !nivel.negativo ? "3 2.4" : undefined}
        opacity={nivel.negativo ? 1 : 0.7}
      />

      <g clipPath={`url(#${id}-vacio)`}>{dibujo(fondo.icono)}</g>
      <g clipPath={`url(#${id}-lleno)`}>
        {tono.patron ? dibujo("text-dona-3", 5.5) : null}
        {dibujo(tono.icono)}
      </g>

      {nivel.alcanzado ? (
        <g>
          <circle cx="41" cy="10" r="6.5" className={`fill-positivo ${fondo.aro}`} strokeWidth={2} />
          <path d="M38.2,10.2 L40.2,12.2 L43.9,8.4" fill="none" className="stroke-white" strokeWidth={1.8} />
        </g>
      ) : null}
    </svg>
  );
}
