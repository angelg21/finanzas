import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/*
  Piezas de formulario según docs/diseno.md: campos de 48 px con fondo suave y radio 14,
  anillo menta al foco; botón principal verde pino en píldora.
*/

const campoBase =
  "h-12 w-full rounded-[14px] border border-tarjeta-borde bg-tarjeta-hover px-4 text-[15px] text-texto placeholder:text-texto-3 focus:outline-none focus:ring-2 focus:ring-palido";

export function Campo({
  etiqueta,
  ayuda,
  children,
  className = "",
}: {
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[12px] font-semibold text-texto-3">{etiqueta}</span>
      {children}
      {ayuda ? <span className="text-[12px] text-texto-3">{ayuda}</span> : null}
    </label>
  );
}

export function Entrada({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${campoBase} ${className}`} {...props} />;
}

export function Selector({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${campoBase} appearance-none ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Boton({
  variante = "primario",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "peligro" }) {
  const estilos = {
    primario: "boton-pino h-12 rounded-full px-5 text-[14px] font-semibold disabled:opacity-60",
    secundario:
      "h-12 rounded-full border border-tarjeta-borde bg-tarjeta px-5 text-[14px] font-semibold text-texto hover:bg-tarjeta-hover disabled:opacity-60",
    peligro: "h-9 rounded-full px-3 text-[13px] font-semibold text-negativo hover:bg-tarjeta-hover disabled:opacity-60",
  }[variante];
  return (
    <button className={`inline-flex items-center justify-center gap-2 ${estilos} ${className}`} {...props}>
      {children}
    </button>
  );
}
