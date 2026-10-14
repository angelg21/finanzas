import Link from "next/link";
import {
  type ButtonHTMLAttributes,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  createElement,
} from "react";
import { coloresCategoria, iconosCategoria } from "@/lib/categorias";
import { fondoDe, fondoElegidoDe, iconoDe } from "./iconos-categoria";
import { Avatar, CirculoCategoria } from "./ui";

/*
  Piezas de formulario según docs/diseno.md: campos de 48 px con fondo suave y radio 14,
  anillo menta al foco; botón principal verde pino en píldora; monto grande y opciones como píldoras.
*/

const campoBase =
  "h-12 w-full rounded-[14px] border border-tarjeta-borde bg-tarjeta-hover px-4 text-[15px] text-texto placeholder:text-texto-3 focus:outline-none focus:ring-2 focus:ring-palido";

/** Mensaje de error junto al campo o al botón; `role="alert"` para que el lector de pantalla lo anuncie. */
export function ErrorCampo({ children }: { children?: string }) {
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
/** La cifra grande con su unidad a la derecha. La unidad es un nodo: puede cambiar con CSS, sin JavaScript. */
export function CampoMonto({
  unidad,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { unidad: ReactNode }) {
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
      <span className="shrink-0 text-[15px] font-bold text-texto-3">{unidad}</span>
    </span>
  );
}

export type OpcionPildora = {
  valor: string;
  texto: string;
  detalle?: string;
  /** Iniciales en un cuadro menta. */
  avatar?: string;
  /** Una categoría: su círculo de color con el icono, en lugar de iniciales. */
  categoria?: { icono: string; color: string };
};

/*
  Opción en píldora, compartida por SelectorPildoras y SelectorFecha. La forma va aparte de los colores:
  dos fondos en el mismo elemento chocan y gana el que Tailwind emite después, no el último escrito.
*/
export const pildoraOpcion =
  "flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors";
export const pildoraNormal = "border-tarjeta-borde bg-tarjeta-hover text-texto-2 hover:text-texto";
/** La opción elegida: menta con texto verde pino. */
export const pildoraElegida = "border-transparent bg-palido text-palido-texto";

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
  alTocar,
  envolver = false,
  extra,
  error,
}: {
  etiqueta: string;
  name: string;
  opciones: OpcionPildora[];
  valorInicial?: string;
  valor?: string;
  onCambio?: (valor: string) => void;
  /** Con cualquier toque a una opción, también a la que ya está marcada, que no emite `change`. */
  alTocar?: (valor: string) => void;
  envolver?: boolean;
  /** Algo más al final de la fila, como la píldora "Nueva" de las categorías. */
  extra?: ReactNode;
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
              onClick={alTocar ? () => alTocar(o.valor) : undefined}
            />
            <span
              className={`${pildoraOpcion} ${pildoraNormal} group-hover:text-texto group-has-checked:border-transparent group-has-checked:bg-palido group-has-checked:text-palido-texto group-has-focus-visible:ring-2 group-has-focus-visible:ring-palido group-has-focus-visible:ring-offset-2 group-has-focus-visible:ring-offset-tarjeta`}
            >
              {o.categoria ? (
                <CirculoCategoria icono={o.categoria.icono} color={o.categoria.color} tamano="sm" className="-ml-1.5" />
              ) : o.avatar ? (
                <Avatar texto={o.avatar} pequeno className="group-has-checked:bg-pildora-blanca" />
              ) : null}
              {o.texto}
              {o.detalle ? <span className="text-[11px] font-medium opacity-75">{o.detalle}</span> : null}
            </span>
          </label>
        ))}
        {extra}
      </div>
      <ErrorCampo>{error}</ErrorCampo>
    </fieldset>
  );
}

/**
 * Icono de una categoría: radios nativos con forma de círculo gris, como los "Símbolos" de la referencia
 * (docs/referencias/categorias-gestor-crear.jpg); el elegido, en menta con anillo. `visibles` filtra por la
 * búsqueda sin quitar radios del formulario, así lo elegido sigue enviándose. Sin JavaScript se ven todos.
 * Iconos de línea, nunca emojis.
 */
export function SelectorIcono({
  name,
  valorInicial,
  visibles,
  color,
  onCambio,
  error,
}: {
  name: string;
  valorInicial: string;
  visibles?: Set<string>;
  /** Con color, el elegido se pinta de ese color; sin él (sin JavaScript), en menta. */
  color?: string;
  onCambio?: (icono: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        data-iconos
        className="relative grid max-h-[264px] grid-cols-6 gap-2 overflow-y-auto rounded-[14px] p-1 sm:grid-cols-8"
      >
        {iconosCategoria.map((i) => (
          <label
            key={i.nombre}
            title={i.palabras[0]}
            className={`group cursor-pointer justify-self-center ${visibles && !visibles.has(i.nombre) ? "hidden" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={i.nombre}
              defaultChecked={i.nombre === valorInicial}
              onChange={onCambio ? () => onCambio(i.nombre) : undefined}
              aria-label={i.palabras[0]}
              className="sr-only"
            />
            <span
              className={`grid size-11 place-items-center rounded-full bg-tarjeta-hover text-texto-2 transition-colors group-hover:text-texto group-has-checked:ring-2 group-has-checked:ring-texto group-has-checked:ring-offset-2 group-has-checked:ring-offset-tarjeta group-has-focus-visible:ring-2 group-has-focus-visible:ring-enlace ${color ? `${fondoElegidoDe(color)} group-has-checked:text-white` : "group-has-checked:bg-palido group-has-checked:text-palido-texto"}`}
            >
              {createElement(iconoDe(i.nombre), { size: 20, strokeWidth: 1.75, "aria-hidden": true })}
            </span>
          </label>
        ))}
      </div>
      <ErrorCampo>{error}</ErrorCampo>
    </div>
  );
}

/** Color de una categoría: radios nativos con forma de círculo de la paleta; el elegido, con anillo. */
export function SelectorColor({
  name,
  valorInicial,
  onCambio,
  error,
}: {
  name: string;
  valorInicial: string;
  onCambio?: (color: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-semibold text-texto-3">Color</legend>
      <div className="flex flex-wrap gap-2.5">
        {coloresCategoria.map((color) => (
          <label key={color} title={color} className="group cursor-pointer">
            <input
              type="radio"
              name={name}
              value={color}
              defaultChecked={color === valorInicial}
              onChange={onCambio ? () => onCambio(color) : undefined}
              aria-label={color}
              className="sr-only"
            />
            <span
              className={`block size-9 rounded-full ${fondoDe(color)} ring-offset-2 ring-offset-tarjeta transition-shadow group-has-checked:ring-2 group-has-checked:ring-texto group-has-focus-visible:ring-2 group-has-focus-visible:ring-enlace`}
            />
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
