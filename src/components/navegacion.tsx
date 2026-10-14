"use client";

import { History, House, Landmark, LogOut, Menu, Plus, Tags, Wallet, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CambioTema } from "./tema";

type Ruta = { href: string; texto: string; Icono: LucideIcon };

const rutas: Ruta[] = [
  { href: "/", texto: "Inicio", Icono: House },
  { href: "/movimientos", texto: "Movimientos", Icono: History },
  { href: "/sobres", texto: "Sobres", Icono: Wallet },
  { href: "/cuentas", texto: "Cuentas", Icono: Landmark },
];

// El "+" y "Registrar movimiento" abren la captura de gasto, lo más frecuente (spec 001, criterio 15).
// Ingreso y Mover siguen en el selector /nuevo; los dos cuentan como "Registrar".
/** En la barra lateral y el menú, no en la barra inferior, que ya tiene sus cinco accesos. */
const secundarias: Ruta[] = [{ href: "/categorias", texto: "Categorías", Icono: Tags }];

const registrar: Ruta = { href: "/nuevo/gasto", texto: "Registrar", Icono: Plus };
const prefijoRegistrar = "/nuevo";

function esActiva(href: string, ruta: string) {
  if (href === registrar.href) return ruta.startsWith(prefijoRegistrar);
  return href === "/" ? ruta === "/" : ruta.startsWith(href);
}

function tituloDe(ruta: string) {
  if (ruta.startsWith(registrar.href)) return "Nuevo gasto";
  if (esActiva(registrar.href, ruta)) return registrar.texto;
  return [...rutas, ...secundarias].find((r) => esActiva(r.href, ruta))?.texto ?? "Finanzas";
}

/** Título de la página actual, para la barra superior de escritorio. */
export function TituloRuta() {
  const ruta = usePathname();
  return <h1 className="text-[22px] font-bold tracking-tight">{tituloDe(ruta)}</h1>;
}

function Marca() {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-[12px] bg-pildora-navy text-[15px] font-bold text-white"
      >
        f
      </span>
      <span className="text-[19px] font-bold tracking-tight">finanzas</span>
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
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-panel-borde px-5 py-7 lg:sticky lg:top-5 lg:flex lg:h-[calc(100dvh-40px)] lg:self-start">
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

/**
 * Barra inferior móvil, como la de la referencia de colores: una píldora flotante con botones
 * redondos; el activo se ensancha y muestra su nombre junto a un círculo verde pino.
 */
export function NavInferior() {
  const ruta = usePathname();
  const [inicio, movimientos, sobres, cuentas] = rutas;
  const orden = [inicio, movimientos, registrar, sobres, cuentas];

  return (
    <nav
      aria-label="Principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-nav-borde bg-nav p-1.5 shadow-tarjeta"
        style={{ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
      >
        {orden.map((r) => {
          const activa = esActiva(r.href, ruta);
          const central = r.href === registrar.href;
          if (central) {
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-label="Registrar movimiento"
                aria-current={activa ? "page" : undefined}
                className="grid size-11 place-items-center rounded-full bg-pildora-navy text-white"
              >
                <Plus size={22} strokeWidth={2.6} aria-hidden />
              </Link>
            );
          }
          if (activa) {
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current="page"
                className="tarjeta flex h-11 items-center gap-2 rounded-full pl-4 pr-1 text-[13px] font-semibold text-texto"
              >
                {r.texto}
                <span className="grid size-9 place-items-center rounded-full bg-pildora-navy text-white">
                  <r.Icono size={17} strokeWidth={2.2} aria-hidden />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={r.href}
              href={r.href}
              aria-label={r.texto}
              className="tarjeta grid size-11 place-items-center rounded-full text-nav-inactivo hover:text-texto"
            >
              <r.Icono size={20} strokeWidth={2} aria-hidden />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
