import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { unidadDe } from "@/lib/dinero";
import { Avatar } from "./ui";

/*
  Piezas de formulario según docs/diseno.md: campos de 48 px con fondo suave y radio 14,
  anillo menta al foco; botón principal verde pino en píldora; monto grande y opciones como píldoras.
*/

const campoBase =
  "h-12 w-full rounded-[14px] border border-tarjeta-borde bg-tarjeta-hover px-4 text-[15px] text-texto placeholder:text-texto-3 focus:outline-none focus:ring-2 focus:ring-palido";

/** Mensaje de error junto al campo; `role="alert"` para que el lector de pantalla lo anuncie. */
function ErrorCampo({ children }: { children?: string }) {
  return children ? (
    <span role="alert" className="text-[12px] font-semibold text-negativo">
      {children}
    </span>
  ) : null;
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
  className = "",
}: {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[12px] font-semibold text-texto-3">{etiqueta}</span>
      {children}
      {error ? (
        <ErrorCampo>{error}</ErrorCampo>
      ) : ayuda ? (
        <span className="text-[12px] text-texto-3">{ayuda}</span>
      ) : null}
    </label>
  );
}

/**
 * Monto grande: la cifra a 36 px en negrita con la unidad de la moneda a la derecha ("VES" se ve "Bs").
 * Teclado decimal en el celular. Va dentro de un `Campo`, que le da la etiqueta.
 */
export function CampoMonto({
  moneda,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { moneda: string }) {
  return (
    <span
      className={`flex h-[72px] items-center gap-3 rounded-[14px] border border-tarjeta-borde bg-tarjeta-hover px-4 focus-within:ring-2 focus-within:ring-palido ${className}`}
    >
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        className="tabular min-w-0 flex-1 bg-transparent text-[36px] font-extrabold leading-none tracking-tight text-texto placeholder:text-texto-3"
        // El foco lo marca el anillo del contenedor. La regla global :focus-visible no está en una capa de
        // Tailwind y le gana a outline-none; el estilo en línea evita el doble anillo.
        style={{ outline: "none" }}
        {...props}
      />
      <span className="shrink-0 text-[15px] font-bold text-texto-3">{unidadDe(moneda)}</span>
    </span>
  );
}

export type OpcionPildora = { valor: string; texto: string; detalle?: string; avatar?: string };

/**
 * Grupo de radios accesible con forma de píldoras: en el celular, una fila desplazable en horizontal;
 * en escritorio, envueltas. `envolver` las envuelve también en el celular, para grupos de pocas opciones
 * que conviene ver de una vez. Sin JavaScript son radios nativos y el formulario los envía igual.
 * La elegida va en menta con texto verde pino. Con `valor` es controlado (para sugerir el sobre);
 * sin él, arranca en `valorInicial` y lo maneja el navegador.
 */
export function SelectorPildoras({
  etiqueta,
  name,
  opciones,
  valorInicial,
  valor,
  onCambio,
  envolver = false,
  error,
}: {
  etiqueta: string;
  name: string;
  opciones: OpcionPildora[];
  valorInicial?: string;
  valor?: string;
  onCambio?: (valor: string) => void;
  envolver?: boolean;
  error?: string;
}) {
  const fila = envolver
    ? "flex flex-wrap gap-2"
    : "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0";
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-semibold text-texto-3">{etiqueta}</legend>
      <div className={fila}>
        {opciones.map((o) => (
          <label key={o.valor} className="group shrink-0 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.valor}
              className="sr-only"
              checked={valor === undefined ? undefined : o.valor === valor}
              defaultChecked={valor === undefined ? o.valor === valorInicial : undefined}
              onChange={onCambio ? () => onCambio(o.valor) : undefined}
            />
            <span className="flex h-10 items-center gap-2 rounded-full border border-tarjeta-borde bg-tarjeta-hover px-3.5 text-[13px] font-semibold whitespace-nowrap text-texto-2 transition-colors group-hover:text-texto group-has-checked:border-transparent group-has-checked:bg-palido group-has-checked:text-palido-texto group-has-focus-visible:ring-2 group-has-focus-visible:ring-palido group-has-focus-visible:ring-offset-2 group-has-focus-visible:ring-offset-tarjeta">
              {o.avatar ? <Avatar texto={o.avatar} pequeno className="group-has-checked:bg-pildora-blanca" /> : null}
              {o.texto}
              {o.detalle ? <span className="text-[11px] font-medium opacity-75">{o.detalle}</span> : null}
            </span>
          </label>
        ))}
      </div>
      <ErrorCampo>{error}</ErrorCampo>
    </fieldset>
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

type VarianteBoton = "primario" | "secundario" | "peligro";

const estilosBoton: Record<VarianteBoton, string> = {
  primario: "boton-pino h-12 rounded-full px-5 text-[14px] font-semibold disabled:opacity-60",
  secundario:
    "h-12 rounded-full border border-tarjeta-borde bg-tarjeta px-5 text-[14px] font-semibold text-texto hover:bg-tarjeta-hover disabled:opacity-60",
  peligro: "h-9 rounded-full px-3 text-[13px] font-semibold text-negativo hover:bg-tarjeta-hover disabled:opacity-60",
};

export function Boton({
  variante = "primario",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 ${estilosBoton[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Un enlace con la forma de un Boton: para acciones que navegan y tienen que funcionar sin JavaScript. */
export function EnlaceBoton({
  variante = "primario",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variante?: VarianteBoton }) {
  return (
    <Link className={`inline-flex items-center justify-center gap-2 ${estilosBoton[variante]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
