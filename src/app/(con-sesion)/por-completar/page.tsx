import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, ListChecks, Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { EnlaceBoton } from "@/components/formulario";
import { CirculoCategoria, Pildora, Tarjeta, TituloPagina } from "@/components/ui";
import { AvisoPasajero } from "@/components/aviso-pasajero";
import { type PorCompletar, listarPorCompletar } from "@/db/por-completar";
import { formatearCentavos } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import { etiquetaDia } from "@/lib/periodos";
import { ConfirmarDescarte } from "./confirmar-descarte";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Por completar" };
export const dynamic = "force-dynamic";

const avisos: Record<string, string> = {
  completado: "Completado",
  completados: "Gastos registrados",
  descartado: "Descartado",
  editado: "Cambios guardados",
  // Spec 010, criterio 2: se completó o se descartó en otra pestaña mientras se corregía.
  yano: "Ese gasto ya se completó o se descartó",
};

/**
 * Los gastos por completar (spec 009, criterio 4), del más viejo al más nuevo, por día. Cada uno se corrige tocándolo
 * (spec 010), se completa en la captura de gasto o se descarta; "Completar varios" los registra juntos. Con
 * `?descartar=`, la confirmación arriba.
 */
export default async function PorCompletarPagina({ searchParams }: PageProps<"/por-completar">) {
  await exigirSesion();
  const parametros = await searchParams;
  const lista = await listarPorCompletar();
  const hoy = hoyEnCaracas(new Date());
  const aviso = Object.keys(avisos).find((clave) => parametros[clave] !== undefined);
  const aDescartar = lista.find((p) => String(p.id) === parametros.descartar);
  const porDia = new Map<string, PorCompletar[]>();
  for (const p of lista) porDia.set(p.fecha, [...(porDia.get(p.fecha) ?? []), p]);

  return (
    <main className="flex flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-[760px] lg:gap-5">
      <TituloPagina titulo="Por completar" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 lg:px-0">
        {aviso ? (
          <AvisoPasajero parametros={Object.keys(avisos)}>
            <Pildora tono={aviso === "yano" ? "navy" : "positiva"}>
              {aviso === "yano" ? <CircleAlert size={13} aria-hidden /> : <CheckCircle2 size={13} aria-hidden />}
              {avisos[aviso]}
            </Pildora>
          </AvisoPasajero>
        ) : (
          <span className="text-[13px] text-texto-2">
            {lista.length === 1
              ? "1 gasto sin monto, cuenta o sobre."
              : `${lista.length} gastos sin monto, cuenta o sobre.`}
          </span>
        )}
        <div className="flex gap-2">
          <EnlaceBoton href="/nuevo/por-completar?desde=lista" variante="secundario" className="h-10">
            <Plus size={16} aria-hidden />
            Anotar
          </EnlaceBoton>
          {lista.length > 1 ? (
            <EnlaceBoton href="/por-completar/varios" variante="primario" className="h-10">
              <ListChecks size={16} aria-hidden />
              Completar varios
            </EnlaceBoton>
          ) : null}
        </div>
      </div>

      {aDescartar ? (
        <Tarjeta>
          <ConfirmarDescarte id={aDescartar.id} que={aDescartar.nota ?? aDescartar.categoria} />
        </Tarjeta>
      ) : null}

      {lista.length === 0 ? (
        <Tarjeta>
          <p className="text-texto-2">No hay gastos por completar.</p>
        </Tarjeta>
      ) : (
        [...porDia.entries()].map(([fecha, pendientes]) => (
          <section key={fecha} aria-label={etiquetaDia(fecha, hoy)}>
            <h2 className="mb-2 px-1 text-[13px] font-bold text-texto-3">{etiquetaDia(fecha, hoy)}</h2>
            <Tarjeta className="py-1 lg:py-1">
              <ul className="divide-y divide-tarjeta-borde">
                {pendientes.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <CirculoCategoria icono={p.icono} color={p.color} />
                    {/* Spec 010: tocarlo lo corrige. */}
                    <Link
                      href={`/por-completar/${p.id}`}
                      className="min-w-0 flex-1 rounded-[12px] focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="line-clamp-2 text-[15px] font-bold break-words">{p.nota ?? p.categoria}</span>
                        <Pencil size={13} className="shrink-0 text-texto-3" aria-hidden />
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-texto-3">
                        {[
                          p.nota ? p.categoria : null,
                          p.montoCentavos !== null && p.moneda
                            ? formatearCentavos(p.montoCentavos, p.moneda)
                            : "sin monto",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="sr-only">, editar</span>
                    </Link>
                    <Link
                      href={`/nuevo/gasto?pendiente=${p.id}`}
                      className="rounded-full px-3 py-2 text-[13px] font-semibold text-enlace hover:bg-tarjeta-hover"
                    >
                      Completar
                    </Link>
                    <Link
                      href={`/por-completar?descartar=${p.id}`}
                      aria-label={`Descartar ${p.nota ?? p.categoria}`}
                      className="grid size-9 place-items-center rounded-full text-texto-3 hover:bg-tarjeta-hover"
                    >
                      <X size={16} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </section>
        ))
      )}
    </main>
  );
}
