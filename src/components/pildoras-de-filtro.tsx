import Link from "next/link";
import { formatearCifraCorta } from "@/lib/dinero";
import { Pildora } from "./ui";

export type PildoraDeFiltro = { clave: string; nombre: string; centavos: number; activa: boolean; href: string };

/**
 * Las píldoras de /movimientos con su total (spec 008): etiquetas en Gastos, categorías en Ingresos. Tocar una filtra la
 * lista y su total; otra vez, lo quita. Son enlaces: funcionan sin JavaScript.
 */
export function PildorasDeFiltro({ etiqueta, opciones }: { etiqueta: string; opciones: PildoraDeFiltro[] }) {
  if (opciones.length === 0) return null;
  return (
    <nav aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((o) => (
        <Link
          key={o.clave}
          href={o.href}
          aria-current={o.activa ? "true" : undefined}
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Pildora tono={o.activa ? "palida" : "oscura"}>
            {o.nombre} <span className="tabular opacity-70">{formatearCifraCorta(o.centavos)}</span>
          </Pildora>
        </Link>
      ))}
    </nav>
  );
}
