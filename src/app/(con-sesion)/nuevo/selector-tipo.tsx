import Link from "next/link";
import { Pildora } from "@/components/ui";

const tipos = [
  { tipo: "gasto", texto: "Gasto", href: "/nuevo/gasto" },
  { tipo: "ingreso", texto: "Ingreso", href: "/nuevo/ingreso" },
  { tipo: "deuda", texto: "Deuda", href: "/nuevo/deuda" },
  { tipo: "mover", texto: "Mover", href: "/nuevo/mover" },
] as const;

/** El selector "Gasto · Ingreso · Deuda · Mover" de las pantallas de Registrar, con la actual en menta. */
export function SelectorTipo({ actual }: { actual: "gasto" | "ingreso" | "deuda" | "mover" }) {
  return (
    <nav aria-label="Tipo de movimiento" className="tarjeta flex w-fit items-center gap-1 rounded-full p-1">
      {tipos.map(({ tipo, texto, href }) =>
        tipo === actual ? (
          <span key={tipo} aria-current="page">
            <Pildora tono="palida">{texto}</Pildora>
          </span>
        ) : (
          <Link
            key={tipo}
            href={href}
            className="rounded-full px-2.5 py-1 text-[12px] font-bold text-texto-2 hover:text-texto"
          >
            {texto}
          </Link>
        ),
      )}
    </nav>
  );
}
