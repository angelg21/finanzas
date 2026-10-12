import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { partesCentavos } from "@/lib/dinero";

/* Piezas base. Fuente de verdad: docs/referencias/ui-referencia.png y docs/diseno.md. */

/** Tarjeta oscura (blanca en claro) con radio 20. */
export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`tarjeta rounded-tarjeta p-4 lg:p-5 ${className}`}>{children}</section>;
}

/** Tarjeta azul pálido con texto azul marino, radio 22. */
export function TarjetaPalida({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`palida rounded-palida p-4 lg:p-5 ${className}`}>{children}</section>;
}

/** Título de tarjeta con enlace "Ver todo" opcional. `palida` ajusta los colores a la tarjeta pálida. */
export function EncabezadoTarjeta({
  titulo,
  enlace,
  derecha,
  palida = false,
}: {
  titulo: string;
  enlace?: { href: string; texto: string };
  derecha?: ReactNode;
  palida?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className={`text-[16px] font-bold ${palida ? "text-palida-texto" : "text-texto"}`}>{titulo}</h2>
      {enlace ? (
        <Link
          href={enlace.href}
          className={`flex items-center gap-0.5 text-[13px] font-semibold ${
            palida ? "text-palida-texto-2 hover:text-palida-texto" : "text-enlace hover:text-texto"
          }`}
        >
          {enlace.texto}
          <ChevronRight size={16} aria-hidden />
        </Link>
      ) : null}
      {derecha}
    </div>
  );
}

type Tono = "texto" | "texto-2" | "texto-3" | "positivo" | "negativo" | "blanco" | "palido" | "palida" | "palida-2";

const tonos: Record<Tono, string> = {
  texto: "text-texto",
  "texto-2": "text-texto-2",
  "texto-3": "text-texto-3",
  positivo: "text-positivo",
  negativo: "text-negativo",
  blanco: "text-white",
  palido: "text-enlace",
  palida: "text-palida-texto",
  "palida-2": "text-palida-texto-2",
};

/**
 * Cantidad de dinero en centavos enteros. En `hero` los centavos van en azul pálido, como en la referencia.
 * `signo` fuerza el + en positivos. El − siempre se muestra en negativos.
 */
export function Cifra({
  centavos,
  moneda = "USD",
  tamano = "md",
  tono = "texto",
  signo = false,
  className = "",
}: {
  centavos: number;
  moneda?: string;
  tamano?: "sm" | "md" | "lg" | "xl" | "hero";
  tono?: Tono;
  signo?: boolean;
  className?: string;
}) {
  const { entero, decimales, unidad, negativo } = partesCentavos(centavos, moneda);
  const prefijo = negativo ? "−" : signo && centavos > 0 ? "+" : "";

  if (tamano === "hero") {
    return (
      <span className={`flex flex-wrap items-baseline gap-x-2 text-white ${className}`}>
        <span className="text-[40px] font-extrabold leading-none tracking-tight lg:text-[52px]">
          {prefijo}
          {entero}
          <span className="text-palido">,{decimales}</span>
        </span>
        <span className="text-[15px] font-bold text-palido">{unidad}</span>
      </span>
    );
  }

  const tamanos = { sm: "text-[13px]", md: "text-[15px]", lg: "text-[20px]", xl: "text-[28px]" } as const;
  return (
    <span
      className={`tabular inline-flex items-baseline gap-1 font-bold ${tamanos[tamano]} ${tonos[tono]} ${className}`}
    >
      <span>
        {prefijo}
        {entero},{decimales}
      </span>
      <span className="text-[0.78em] font-semibold opacity-75">{unidad}</span>
    </span>
  );
}

/**
 * Píldora:
 *   oscura  → gris claro sobre tarjeta blanca (translúcida en tema oscuro)
 *   hero    → translúcida clara sobre la tarjeta principal
 *   navy    → verde pino sólida con texto blanco, sobre tarjetas pálidas o blancas
 *   blanca  → blanca translúcida con texto verde pino, sobre tarjetas pálidas
 *   positiva / negativa → como oscura, con el texto en verde o rojo
 *   palida  → menta con texto verde pino: la opción activa, como la elegida en SelectorPildoras
 */
export function Pildora({
  children,
  tono = "oscura",
  className = "",
}: {
  children: ReactNode;
  tono?: "oscura" | "hero" | "navy" | "blanca" | "positiva" | "negativa" | "palida";
  className?: string;
}) {
  const estilos = {
    oscura: "bg-pildora-oscura text-pildora-oscura-texto",
    hero: "bg-pildora-hero text-white",
    navy: "bg-pildora-navy text-white",
    blanca: "bg-pildora-blanca text-palida-texto",
    positiva: "bg-pildora-hero text-positivo",
    negativa: "bg-pildora-hero text-negativo",
    palida: "bg-palido text-palido-texto",
  }[tono];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${estilos} ${className}`}
    >
      {children}
    </span>
  );
}

/** Cuadro azul pálido con iniciales, radio 10. `pequeno` para dentro de una píldora. */
export function Avatar({
  texto,
  pequeno = false,
  className = "",
}: {
  texto: string;
  pequeno?: boolean;
  className?: string;
}) {
  const tamano = pequeno ? "size-6 rounded-[8px] text-[10px]" : "size-11 rounded-avatar text-[13px]";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center bg-palido font-extrabold uppercase text-palido-texto ${tamano} ${className}`}
    >
      {texto}
    </span>
  );
}

const vacias = new Set(["de", "del", "la", "el", "los", "las", "y", "o", "a", "en", "para", "por", "con"]);

/** Iniciales de un nombre, saltando artículos y preposiciones: "Gastos del mes" → "GM". */
export function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/);
  const significativas = palabras.filter((p) => !vacias.has(p.toLowerCase()));
  const base = significativas.length ? significativas : palabras;
  return base
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");
}

/** Fila de lista como "Top Holdings": avatar, nombre en mayúsculas, subtítulo y columna derecha. */
export function FilaLista({
  avatar,
  titulo,
  subtitulo,
  derecha,
  href,
}: {
  avatar: ReactNode;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  derecha?: ReactNode;
  href?: string;
}) {
  const contenido = (
    <>
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-extrabold uppercase tracking-wide">{titulo}</span>
        {subtitulo ? <span className="mt-0.5 block truncate text-[12px] text-texto-3">{subtitulo}</span> : null}
      </span>
      {derecha ? <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">{derecha}</span> : null}
    </>
  );
  const clases = "flex items-center gap-3 py-2.5";
  return href ? (
    <Link href={href} className={`${clases} -mx-2 rounded-[14px] px-2 hover:bg-tarjeta-hover`}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

/** Barra de progreso redondeada. Sobre tarjeta oscura llena en azul pálido; sobre pálida, en azul marino. */
export function Progreso({ valor, palida = false }: { valor: number; palida?: boolean }) {
  const porcentaje = Math.max(0, Math.min(1, valor)) * 100;
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full ${palida ? "bg-palida-pista" : "bg-white/10"}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(porcentaje)}
    >
      <div
        className={`h-full rounded-full ${palida ? "bg-pildora-navy" : "bg-palido"}`}
        style={{ width: `${porcentaje}%` }}
      />
    </div>
  );
}

/** Botón de acción en mosaico: icono dentro de un círculo de contorno y texto debajo. Va dentro de la tarjeta principal. */
export function Mosaico({ href, icono, texto }: { href: string; icono: ReactNode; texto: string }) {
  return (
    <Link
      href={href}
      className="mosaico flex flex-col items-center gap-2 rounded-mosaico px-2 py-3 text-[12px] font-semibold text-white hover:bg-white/10 lg:py-4 lg:text-[13px]"
    >
      <span className="grid size-9 place-items-center rounded-full border-[1.5px] border-mosaico-icono-borde lg:size-10">
        {icono}
      </span>
      {texto}
    </Link>
  );
}

/** Par etiqueta y valor para pies de tarjeta pálida: "Total invertido: 96 USD". */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <span className="text-[12px] font-semibold text-palida-texto-2">
      {etiqueta}: <span className="font-bold text-palida-texto">{children}</span>
    </span>
  );
}

/** Título de página. Solo en móvil: en escritorio lo muestra la barra superior. */
export function TituloPagina({ titulo, detalle }: { titulo: string; detalle?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 px-1 lg:hidden">
      <h1 className="text-[24px] font-extrabold tracking-tight">{titulo}</h1>
      {detalle ? <div className="text-[13px] text-texto-3">{detalle}</div> : null}
    </div>
  );
}
