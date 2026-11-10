import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BotonCalendario } from "@/components/calendario";
import { Boton, Entrada } from "@/components/formulario";
import { GraficaCategorias } from "@/components/grafica-categorias";
import { FilaMovimiento } from "@/components/movimiento";
import { Pestanas } from "@/components/pestanas";
import { CheckCircle2 } from "lucide-react";
import { Cifra, Pildora, Tarjeta, TituloPagina } from "@/components/ui";
import { AvisoPasajero } from "@/components/aviso-pasajero";
import {
  type MovimientoDelPeriodo,
  categoriaDeLaPestana,
  etiquetasDelPeriodo,
  movimientosDelPeriodo,
  resumenPorDia,
  totalesPorCategoria,
} from "@/db/movimientos-del-periodo";
import { etiquetaPorId } from "@/db/etiquetas";
import { exigirSesion } from "@/app/sesion";
import { avisoDeVuelta, enlaceDeEdicion } from "./[id]/valores";
import { distribuirPorCategoria } from "@/lib/distribucion";
import { leerIdEtiqueta } from "@/lib/etiquetas";
import { formatearCifraCorta } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import {
  type Filtros,
  consultaDeFiltros,
  esPeriodoActual,
  etiquetaDia,
  etiquetaPeriodo,
  leerFiltros,
  moverPeriodo,
  pestanasMovimientos,
  rangoDePeriodo,
  tiposPeriodo,
} from "@/lib/periodos";

export const metadata: Metadata = { title: "Movimientos" };
export const dynamic = "force-dynamic";

const LIMITE = 200;
/** Todo es para ver la lista entera, también el historial importado (spec 012): con el corte de los demás no se vería. */
const LIMITE_TODO = 1000;
const textoPestana = { gastos: "Gastos", ingresos: "Ingresos", mover: "Mover" } as const;
const textoPeriodo = { dia: "Día", semana: "Semana", mes: "Mes", anio: "Año", todo: "Todo" } as const;
const nada = {
  gastos: "No hay gastos",
  ingresos: "No hay ingresos",
  mover: "No hay movimientos entre cuentas ni sobres",
} as const;

/** "hoy", "el lunes 12 de octubre", "en la semana del 12 – 18 oct 2026", "en octubre de 2026" o "en 2026". */
function cuando({ periodo, fecha }: Filtros, hoy: string) {
  const etiqueta = etiquetaPeriodo(periodo, fecha, hoy);
  const minuscula = etiqueta.charAt(0).toLowerCase() + etiqueta.slice(1);
  if (periodo === "dia") return etiqueta === "Hoy" || etiqueta === "Ayer" ? minuscula : `el ${minuscula}`;
  if (periodo === "semana") return `en la semana del ${etiqueta}`;
  return `en ${minuscula}`;
}

/**
 * Movimientos (spec 003): Gastos, Ingresos y Mover; el periodo con sus flechas; en Gastos e Ingresos, el anillo por
 * categoría con su leyenda que filtra; y la lista por día. Todo son enlaces con parámetros que valida `leerFiltros`:
 * funciona sin JavaScript. Dos tandas en paralelo: los totales por categoría y, con filtros, la categoría por su tipo
 * y la etiqueta (spec 008); después la lista, el resumen por día y las etiquetas del periodo.
 */
export default async function Movimientos({ searchParams }: PageProps<"/movimientos">) {
  await exigirSesion();
  const hoy = hoyEnCaracas(new Date());
  const parametros = await searchParams;
  const pedidos = leerFiltros(parametros, hoy);
  const aviso = avisoDeVuelta(parametros);
  // Spec 008: la etiqueta se valida aparte, sin tocar los filtros de la 003, y viaja en los enlaces de la página. Una
  // que no existe no filtra, y en Mover no aplica: solo gastos e ingresos llevan etiqueta (revisión de la 008).
  const idEtiqueta = leerIdEtiqueta(parametros.etiqueta);
  const rango = rangoDePeriodo(pedidos.periodo, pedidos.fecha);
  const conAnillo = pedidos.pestana !== "mover";

  const [totales, pedida, etiqueta] =
    pedidos.pestana === "mover"
      ? [[], null, null]
      : await Promise.all([
          totalesPorCategoria(pedidos.pestana, rango),
          pedidos.categoria === null ? null : categoriaDeLaPestana(pedidos.pestana, pedidos.categoria),
          idEtiqueta === null ? null : etiquetaPorId(idEtiqueta),
        ]);
  // Filtra cualquier categoría del tipo de la pestaña, aunque no tenga movimientos en el periodo: entonces lo dice y el
  // filtro sigue en las flechas, las píldoras y el calendario (criterio 6). Una de otro tipo, o que no existe, no filtra.
  const categoria = pedida && {
    ...pedida,
    centavos: totales.find((t) => t.categoriaId === pedida.categoriaId)?.centavos ?? 0,
  };
  const filtros: Filtros = { ...pedidos, categoria: categoria?.categoriaId ?? null };
  const [lista, dias, delPeriodo] = await Promise.all([
    movimientosDelPeriodo(
      filtros.pestana,
      rango,
      filtros.categoria,
      filtros.periodo === "todo" ? LIMITE_TODO : LIMITE,
      etiqueta?.id ?? null,
    ),
    resumenPorDia(filtros.pestana, rango, filtros.categoria, etiqueta?.id ?? null),
    filtros.pestana === "mover" ? [] : etiquetasDelPeriodo(filtros.pestana, rango, filtros.categoria),
  ]);
  // La activa siempre tiene su píldora, aunque no haya movimientos con ella en el periodo o la categoría: tocarla otra
  // vez la quita (revisión de la 008, hallazgo 3).
  const etiquetas =
    etiqueta && !delPeriodo.some((e) => e.id === etiqueta.id)
      ? [...delPeriodo, { id: etiqueta.id, nombre: etiqueta.nombre, centavos: 0 }]
      : delPeriodo;

  const enlace = (cambios: Partial<Filtros> & { etiqueta?: number | null }) => {
    const { etiqueta: conEtiqueta = etiqueta?.id ?? null, ...resto } = cambios;
    const base = `/movimientos${consultaDeFiltros({ ...filtros, ...resto }, hoy)}`;
    if (!conEtiqueta) return base;
    return `${base}${base.includes("?") ? "&" : "?"}etiqueta=${conEtiqueta}`;
  };
  const { total, porciones } = distribuirPorCategoria(totales);
  const cuantos = dias.reduce((a, d) => a + d.cantidad, 0);
  const porDia = new Map(dias.map((d) => [d.fecha, d.centavos]));

  const grupos = new Map<string, MovimientoDelPeriodo[]>();
  for (const m of lista) grupos.set(m.fecha, [...(grupos.get(m.fecha) ?? []), m]);

  const listaDelPeriodo = (
    <div className="flex flex-col gap-4">
      {conAnillo ? (
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="flex items-baseline gap-1.5 text-[15px] font-bold">
            {[categoria?.nombre, etiqueta?.nombre].filter(Boolean).join(" · ") || "Todas"} ·{" "}
            <Cifra
              centavos={etiqueta ? dias.reduce((a, d) => a + d.centavos, 0) : categoria ? categoria.centavos : total}
              tamano="md"
            />
          </h2>
          {cuantos > lista.length ? (
            <span className="text-[12px] text-texto-3">
              {lista.length} de {cuantos}
            </span>
          ) : null}
        </div>
      ) : cuantos > lista.length ? (
        <p className="px-1 text-[12px] text-texto-3">
          {lista.length} de {cuantos}
        </p>
      ) : null}

      {lista.length === 0 ? (
        <Tarjeta>
          <p className="text-texto-2">
            {nada[filtros.pestana]}
            {categoria ? ` de ${categoria.nombre}` : ""}
            {etiqueta ? ` con ${etiqueta.nombre}` : ""} {cuando(filtros, hoy)}.
          </p>
        </Tarjeta>
      ) : (
        [...grupos.entries()].map(([fecha, movimientos]) => (
          <section key={fecha} aria-label={etiquetaDia(fecha, hoy)}>
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <h3 className="text-[13px] font-bold text-texto-3">{etiquetaDia(fecha, hoy)}</h3>
              {conAnillo ? (
                <Cifra
                  centavos={filtros.pestana === "gastos" ? -(porDia.get(fecha) ?? 0) : (porDia.get(fecha) ?? 0)}
                  signo={filtros.pestana === "ingresos"}
                  tamano="sm"
                  tono="texto-3"
                />
              ) : null}
            </div>
            <Tarjeta className="py-1 lg:py-1">
              <ul className="divide-y divide-tarjeta-borde">
                {movimientos.map((m) => (
                  <li key={m.id}>
                    <FilaMovimiento m={m} href={enlaceDeEdicion(m, enlace({}))} />
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </section>
        ))
      )}
    </div>
  );

  const actual = esPeriodoActual(filtros.periodo, filtros.fecha, hoy);
  const flecha = "grid size-10 place-items-center rounded-full";

  return (
    <main className="flex flex-col gap-4 lg:gap-5">
      <TituloPagina titulo="Movimientos" />
      {aviso ? (
        <AvisoPasajero parametros={["editado", "borrado"]}>
          <Pildora tono="positiva">
            <CheckCircle2 size={13} aria-hidden />
            {aviso}
          </Pildora>
        </AvisoPasajero>
      ) : null}

      {/* En fila solo desde 1280 px: entre 1024 y 1279 los tres controles no caben junto a la barra lateral. */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="xl:w-[360px]">
          <Pestanas
            etiqueta="Tipo de movimiento"
            llena
            activa={filtros.pestana}
            opciones={pestanasMovimientos.map((p) => ({
              clave: p,
              texto: textoPestana[p],
              // Mover no lleva etiquetas: ir ahí no se lleva el filtro (revisión de la 008, hallazgo 2).
              href: enlace({ pestana: p, categoria: null, ...(p === "mover" ? { etiqueta: null } : {}) }),
            }))}
          />
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          <div className="lg:w-[300px]">
            <Pestanas
              etiqueta="Periodo"
              llena
              activa={filtros.periodo}
              opciones={tiposPeriodo.map((t) => ({ clave: t, texto: textoPeriodo[t], href: enlace({ periodo: t }) }))}
            />
          </div>
          <nav aria-label="Cambiar de periodo" className="flex items-center justify-between gap-2 lg:min-w-[260px]">
            {/* Todo no tiene periodo anterior ni siguiente: las dos flechas quedan apagadas. */}
            {filtros.periodo === "todo" ? (
              <span aria-hidden className={`${flecha} text-texto-3 opacity-40`}>
                <ChevronLeft size={22} />
              </span>
            ) : (
              <Link
                href={enlace({ fecha: moverPeriodo(filtros.periodo, filtros.fecha, -1, hoy) })}
                aria-label="Periodo anterior"
                className={`${flecha} text-texto hover:bg-tarjeta-hover`}
              >
                <ChevronLeft size={22} aria-hidden />
              </Link>
            )}
            {/* Elegir un día lleva a ese día; desde ahí, Semana, Mes o Año muestran el suyo (se conserva la fecha). */}
            <BotonCalendario
              destino={enlace({ periodo: "dia", fecha: hoy })}
              elegida={filtros.periodo === "dia" ? filtros.fecha : ""}
              inicio={filtros.fecha}
              hoy={hoy}
            >
              {etiquetaPeriodo(filtros.periodo, filtros.fecha, hoy)}
            </BotonCalendario>
            {actual ? (
              <span aria-hidden className={`${flecha} text-texto-3 opacity-40`}>
                <ChevronRight size={22} />
              </span>
            ) : (
              <Link
                href={enlace({ fecha: moverPeriodo(filtros.periodo, filtros.fecha, 1, hoy) })}
                aria-label="Periodo siguiente"
                className={`${flecha} text-texto hover:bg-tarjeta-hover`}
              >
                <ChevronRight size={22} aria-hidden />
              </Link>
            )}
          </nav>
          <noscript>
            {/* Sin JavaScript el calendario no abre: un campo de fecha nativo hace lo mismo. */}
            <form method="get" action="/movimientos" className="flex items-center gap-2">
              {filtros.pestana !== "gastos" ? <input type="hidden" name="tipo" value={filtros.pestana} /> : null}
              {filtros.categoria !== null ? <input type="hidden" name="categoria" value={filtros.categoria} /> : null}
              {etiqueta ? <input type="hidden" name="etiqueta" value={etiqueta.id} /> : null}
              <input type="hidden" name="periodo" value="dia" />
              <Entrada
                type="date"
                name="fecha"
                defaultValue={filtros.fecha}
                max={hoy}
                aria-label="Ir a un día"
                className="flex-1"
              />
              <Boton type="submit" variante="secundario">
                Ver
              </Boton>
            </form>
          </noscript>
        </div>
      </div>

      {etiquetas.length > 0 ? (
        // Spec 008: las etiquetas del periodo con su total. Tocar una filtra la lista y su total; otra vez, lo quita.
        <nav aria-label="Etiquetas" className="flex flex-wrap gap-2">
          {etiquetas.map((e) => (
            <Link
              key={e.id}
              href={enlace({ etiqueta: e.id === etiqueta?.id ? null : e.id })}
              aria-current={e.id === etiqueta?.id ? "true" : undefined}
              className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Pildora tono={e.id === etiqueta?.id ? "palida" : "oscura"}>
                {e.nombre} <span className="tabular opacity-70">{formatearCifraCorta(e.centavos)}</span>
              </Pildora>
            </Link>
          ))}
        </nav>
      ) : null}

      {conAnillo ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="lg:sticky lg:top-6 lg:col-span-5 lg:self-start">
            <Tarjeta>
              <GraficaCategorias
                titulo={`${textoPestana[filtros.pestana]} por categoría, ${etiquetaPeriodo(filtros.periodo, filtros.fecha, hoy)}`}
                etiquetaCentro={filtros.pestana === "gastos" ? "USD EN GASTOS" : "USD EN INGRESOS"}
                total={total}
                elegida={categoria ? String(categoria.categoriaId) : null}
                hrefTodas={enlace({ categoria: null })}
                porciones={porciones.map((p) => ({
                  clave: String(p.categoriaId),
                  nombre: p.nombre,
                  color: p.color,
                  centavos: p.centavos,
                  porcentaje: p.porcentaje,
                  menosDeUno: p.menosDeUno,
                  href: enlace({ categoria: p.categoriaId }),
                }))}
              />
            </Tarjeta>
          </div>
          <div className="lg:col-span-7">{listaDelPeriodo}</div>
        </div>
      ) : (
        <div className="w-full lg:mx-auto lg:max-w-[760px]">{listaDelPeriodo}</div>
      )}
    </main>
  );
}
