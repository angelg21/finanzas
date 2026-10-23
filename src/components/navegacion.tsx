"use client";

import {
  ClipboardList,
  HandCoins,
  History,
  House,
  Landmark,
  LogOut,
  Menu,
  Plus,
  Tags,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { nombreApp } from "@/lib/marca";
import { Emblema } from "./emblema";
import { CambioTema } from "./tema";

type Ruta = { href: string; texto: string; Icono: LucideIcon };

const rutas: Ruta[] = [
  { href: "/", texto: "Inicio", Icono: House },
  { href: "/movimientos", texto: "Movimientos", Icono: History },
  { href: "/sobres", texto: "Sobres", Icono: Wallet },
  { href: "/cuentas", texto: "Cuentas", Icono: Landmark },
  { href: "/deudas", texto: "Deudas", Icono: HandCoins },
];

// El "+" y "Registrar movimiento" abren la captura de gasto, lo más frecuente (spec 001, criterio 15).
// Ingreso tiene su pantalla (spec 004) y Mover sigue en el selector /nuevo; todas cuentan como "Registrar".
/**
 * En la barra lateral y el menú, después de las principales. "Por completar" está siempre a mano: Registrar abre
 * directo la captura y su aviso solo salía en el inicio (spec 010, criterio 4).
 */
const secundarias: Ruta[] = [
  { href: "/por-completar", texto: "Por completar", Icono: ClipboardList },
  { href: "/categorias", texto: "Categorías", Icono: Tags },
];

const registrar: Ruta = { href: "/nuevo/gasto", texto: "Registrar", Icono: Plus };
const prefijoRegistrar = "/nuevo";

function esActiva(href: string, ruta: string) {
  if (href === registrar.href) return ruta.startsWith(prefijoRegistrar);
  return href === "/" ? ruta === "/" : ruta.startsWith(href);
}

function tituloDe(ruta: string) {
  if (ruta.startsWith(registrar.href)) return "Nuevo gasto";
  if (ruta.startsWith("/nuevo/ingreso")) return "Nuevo ingreso";
  if (ruta.startsWith("/nuevo/deuda")) return "Pagar o cobrar";
  if (ruta.startsWith("/sobres/reglas")) return "Reglas de reparto";
  if (ruta.startsWith("/sobres/repartir")) return "Repartir";
  if (ruta.startsWith("/deudas/nueva")) return "Nueva deuda";
  if (ruta.startsWith("/deudas/prestar")) return "Prestar";
  if (ruta.startsWith("/deudas/apartar")) return "Apartar para deudas";
  if (/^\/deudas\/\d+\/editar/.test(ruta)) return "Editar deuda";
  if (ruta.startsWith("/nuevo/mover")) return "Mover entre sobres";
  if (ruta.startsWith("/nuevo/por-completar")) return "Anotar por completar";
  if (ruta.startsWith("/por-completar/varios")) return "Completar varios";
  if (/^\/por-completar\/\d+/.test(ruta)) return "Editar por completar";
  if (ruta.startsWith("/por-completar")) return "Por completar";
  if (/^\/movimientos\/\d+/.test(ruta)) return "Movimiento";
  if (esActiva(registrar.href, ruta)) return registrar.texto;
  return [...rutas, ...secundarias].find((r) => esActiva(r.href, ruta))?.texto ?? nombreApp;
}

/** Título de la página actual, para la barra superior de escritorio. */
export function TituloRuta() {
  const ruta = usePathname();
  return <h1 className="text-[22px] font-bold tracking-tight">{tituloDe(ruta)}</h1>;
}

/** El emblema del logo y el nombre de la app. */
export function Marca({ tamano = 38 }: { tamano?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Emblema tamano={tamano} />
      <span className="text-[21px] font-extrabold tracking-tight">{nombreApp}</span>
    </span>
  );
}

function EnlaceLateral({ href, texto, Icono, ruta, alHacerClic }: Ruta & { ruta: string; alHacerClic?: () => void }) {
  const activa = esActiva(href, ruta);
  return (
    <Link
      href={href}
      onClick={alHacerClic}
      aria-current={activa ? "page" : undefined}
      className={`flex items-center gap-3 rounded-full px-4 py-3 text-[14px] font-semibold ${
        activa ? "bg-palido text-palido-texto" : "text-texto-2 hover:bg-tarjeta-hover hover:text-texto"
      }`}
    >
      <Icono size={20} strokeWidth={activa ? 2.4 : 2} aria-hidden />
      {texto}
    </Link>
  );
}

function BotonRegistrar({ alHacerClic }: { alHacerClic?: () => void }) {
  return (
    <Link
      href={registrar.href}
      onClick={alHacerClic}
      className="boton-pino flex items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold"
    >
      <Plus size={18} strokeWidth={2.6} aria-hidden />
      Registrar movimiento
    </Link>
  );
}

/** La acción de salir llega de la ruta: los componentes no conocen las acciones (ADR 0005). */
type ConSalir = { salir: () => Promise<void> };

/**
 * "Salir", con la forma de un enlace lateral. Es un formulario con su server action: funciona sin JavaScript.
 */
function BotonSalir({ salir }: ConSalir) {
  return (
    <form action={salir}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-[14px] font-semibold text-texto-2 hover:bg-tarjeta-hover hover:text-texto"
      >
        <LogOut size={20} strokeWidth={2} aria-hidden />
        Salir
      </button>
    </form>
  );
}

/** Barra lateral de escritorio. */
export function BarraLateral({ salir }: ConSalir) {
  const ruta = usePathname();
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-panel-borde px-5 py-7 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start">
      <Link href="/" className="mb-9 px-2">
        <Marca />
      </Link>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {[...rutas, ...secundarias].map((r) => (
          <EnlaceLateral key={r.href} {...r} ruta={ruta} />
        ))}
      </nav>
      <div className="mt-6">
        <BotonRegistrar />
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <CambioTema conTexto />
        <BotonSalir salir={salir} />
        <p className="px-2 text-[12px] leading-relaxed text-texto-3">
          Presupuesto por sobres. Cada dólar tiene un trabajo.
        </p>
      </div>
    </aside>
  );
}

/** Botón de menú de la barra superior móvil, con su panel deslizante. */
export function MenuMovil({ salir }: ConSalir) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
  }, [abierto]);

  const cerrar = () => setAbierto(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={abierto}
        className="grid size-10 place-items-center rounded-full text-texto"
      >
        <Menu size={24} aria-hidden />
      </button>

      {abierto ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" aria-label="Cerrar menú" onClick={cerrar} className="absolute inset-0 bg-black/40" />
          <div className="panel absolute inset-y-0 left-0 flex w-[290px] max-w-[85vw] flex-col border-r border-panel-borde px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))] shadow-panel">
            <div className="mb-8 flex items-center justify-between">
              <Marca />
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar menú"
                className="grid size-10 place-items-center rounded-full text-texto-2 hover:text-texto"
              >
                <X size={22} aria-hidden />
              </button>
            </div>
            <nav aria-label="Principal" className="flex flex-col gap-1">
              {[...rutas, ...secundarias].map((r) => (
                <EnlaceLateral key={r.href} {...r} ruta={ruta} alHacerClic={cerrar} />
              ))}
              <BotonSalir salir={salir} />
            </nav>
            <div className="mt-6">
              <BotonRegistrar alHacerClic={cerrar} />
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <CambioTema conTexto />
              <p className="px-2 text-[12px] leading-relaxed text-texto-3">
                Presupuesto por sobres. Cada dólar tiene un trabajo.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Las pantallas que son un formulario, además de registrar: editar, crear, repartir, las reglas, completar varios. */
const formularios = [
  /^\/movimientos\/\d+/,
  /^\/categorias\/(nueva|\d+)/,
  // El detalle de una deuda (registrar un pago o un cobro) y el de un sobre (el desglose de un fondo) también.
  /^\/deudas\/(nueva|prestar|apartar|\d+)/,
  /^\/sobres\/(repartir|reglas|\d+)/,
  /^\/por-completar\/(varios|\d+)/,
];

/**
 * El "+" flotante del celular, abajo a la derecha: registrar un gasto queda a un toque y al alcance del pulgar.
 * Reemplaza a la barra inferior (pedido del desarrollador, 2026-10-14); lo demás está en el menú. No sale en las
 * pantallas de registrar ni en las que son un formulario: taparía su botón, y tocarlo abandonaría lo escrito
 * (revisión de la 006, hallazgo 4).
 */
export function BotonFlotanteRegistrar() {
  const ruta = usePathname();
  if (esActiva(registrar.href, ruta) || formularios.some((f) => f.test(ruta))) return null;
  return (
    <Link
      href={registrar.href}
      aria-label="Registrar movimiento"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-20 boton-pino grid size-14 place-items-center rounded-full shadow-tarjeta lg:hidden"
    >
      <Plus size={26} strokeWidth={2.6} aria-hidden />
    </Link>
  );
}
