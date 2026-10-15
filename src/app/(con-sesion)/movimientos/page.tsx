import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BotonCalendario } from "@/components/calendario";
import { Boton, Entrada } from "@/components/formulario";
import { GraficaCategorias } from "@/components/grafica-categorias";
import { FilaMovimiento } from "@/components/movimiento";
import { Pestanas } from "@/components/pestanas";
import { Cifra, Tarjeta, TituloPagina } from "@/components/ui";
import {
  type MovimientoDelPeriodo,
  movimientosDelPeriodo,
  resumenPorDia,
  totalesPorCategoria,
} from "@/db/movimientos-del-periodo";
import { exigirSesion } from "@/app/sesion";
import { distribuirPorCategoria } from "@/lib/distribucion";
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
const textoPestana = { gastos: "Gastos", ingresos: "Ingresos", mover: "Mover" } as const;
const textoPeriodo = { dia: "Día", semana: "Semana", mes: "Mes", anio: "Año" } as const;
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
 * funciona sin JavaScript. Tres consultas: totales por categoría, lista y resumen por día.
 */
export default async function Movimientos({ searchParams }: PageProps<"/movimientos">) {
  await exigirSesion();
  const hoy = hoyEnCaracas(new Date());
  const pedidos = leerFiltros(await searchParams, hoy);
  const rango = rangoDePeriodo(pedidos.periodo, pedidos.fecha);
  const conAnillo = pedidos.pestana !== "mover";

  const totales = pedidos.pestana === "mover" ? [] : await totalesPorCategoria(pedidos.pestana, rango);
  // Una categoría sin movimientos de esta pestaña en el periodo (de otro tipo, o que no existe) no filtra.
  const categoria = totales.find((t) => t.categoriaId === pedidos.categoria) ?? null;
  const filtros: Filtros = { ...pedidos, categoria: categoria?.categoriaId ?? null };
  const [lista, dias] = await Promise.all([
    movimientosDelPeriodo(filtros.pestana, rango, filtros.categoria, LIMITE),
    resumenPorDia(filtros.pestana, rango, filtros.categoria),
  ]);

  const enlace = (cambios: Partial<Filtros>) => `/movimientos${consultaDeFiltros({ ...filtros, ...cambios }, hoy)}`;
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
            {categoria ? categoria.nombre : "Todas"} ·{" "}
            <Cifra centavos={categoria ? categoria.centavos : total} tamano="md" />
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
            {categoria ? ` de ${categoria.nombre}` : ""} {cuando(filtros, hoy)}.
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
                    <FilaMovimiento m={m} />
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="lg:w-[360px]">
          <Pestanas
            etiqueta="Tipo de movimiento"
            llena
            activa={filtros.pestana}
            opciones={pestanasMovimientos.map((p) => ({
              clave: p,
              texto: textoPestana[p],
              href: enlace({ pestana: p, categoria: null }),
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
            <Link
              href={enlace({ fecha: moverPeriodo(filtros.periodo, filtros.fecha, -1, hoy) })}
              aria-label="Periodo anterior"
              className={`${flecha} text-texto hover:bg-tarjeta-hover`}
            >
              <ChevronLeft size={22} aria-hidden />
            </Link>
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
