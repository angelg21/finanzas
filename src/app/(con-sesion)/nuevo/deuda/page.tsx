import type { Metadata } from "next";
import { EncabezadoTarjeta, Pildora, Tarjeta } from "@/components/ui";
import { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaPagar } from "@/db/consultas";
import { deudasConPendiente } from "@/db/deudas";
import { sobrePorAsignar } from "@/db/reparto";
import { hoyEnCaracas } from "@/lib/fechas";
import { avisosDeLiquidez } from "@/lib/liquidez";
import { Saldar } from "../../deudas/[id]/saldar";
import { FilaDeuda } from "../../deudas/fila-deuda";
import { NadaPorAqui } from "../../deudas/nada-por-aqui";
import { SelectorTipo } from "../selector-tipo";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Pagar o cobrar" };
export const dynamic = "force-dynamic";

/** El ancla del formulario: al elegir una deuda en el celular, la página baja hasta él. */
const ancla = "registrar";

const listas = [
  { titulo: "Debo", sentido: "debo", vacia: "/deudas/nueva", fila: "lg:row-start-2" },
  { titulo: "Me deben", sentido: "me_deben", vacia: "/deudas/nueva?sentido=me_deben", fila: "lg:row-start-3" },
] as const;

/**
 * Pagar o cobrar desde Registrar (spec 005, criterio 23): las deudas abiertas, Debo y Me deben, y con una elegida el
 * mismo formulario y la misma acción que su detalle. La elección viaja en `?deuda=`, así funciona sin JavaScript. Al
 * guardar, la acción lleva al detalle de la deuda con "Pago guardado" o "Cobro guardado".
 */
export default async function PagarOCobrar({ searchParams }: PageProps<"/nuevo/deuda">) {
  await exigirSesion();
  const { deuda: pedida } = await searchParams;
  const [deudas, sobres, categorias, porAsignar, cuentas] = await Promise.all([
    deudasConPendiente(),
    sobresParaPagar(),
    categoriasDeGastoPorUso(),
    sobrePorAsignar(),
    saldosPorCuenta(),
  ]);
  const hoy = hoyEnCaracas(new Date());
  const avisos = avisosDeLiquidez({ deudas, cuentas });
  const abiertas = deudas.filter((d) => d.estado === "abierta");
  const elegida = abiertas.find((d) => String(d.id) === pedida);

  return (
    // La última fila absorbe el alto del formulario, que abarca dos, como en el detalle de la deuda.
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-5">
      <header className="flex flex-col gap-3 px-1 lg:col-span-12 lg:px-0">
        <h1 className="text-[24px] font-extrabold tracking-tight lg:hidden">Pagar o cobrar</h1>
        <SelectorTipo actual="deuda" />
      </header>

      {listas.map(({ titulo, sentido, vacia, fila }) => {
        const deEste = abiertas.filter((d) => d.sentido === sentido);
        return (
          <Tarjeta key={sentido} className={`lg:col-span-7 lg:col-start-1 ${fila}`}>
            <EncabezadoTarjeta
              titulo={titulo}
              derecha={deEste.length > 0 ? <Pildora>{deEste.length} abiertas</Pildora> : undefined}
            />
            {deEste.length === 0 ? (
              <NadaPorAqui href={vacia} />
            ) : (
              <div className="flex flex-col">
                {deEste.map((d) => (
                  <FilaDeuda
                    key={d.id}
                    deuda={d}
                    hoy={hoy}
                    aviso={avisos.get(d.id)?.texto}
                    href={`/nuevo/deuda?deuda=${d.id}#${ancla}`}
                    elegida={d.id === elegida?.id}
                  />
                ))}
              </div>
            )}
          </Tarjeta>
        );
      })}

      <div
        id={ancla}
        className="scroll-mt-4 lg:sticky lg:top-24 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-2"
      >
        <Tarjeta>
          {elegida ? (
            <>
              <EncabezadoTarjeta
                titulo={elegida.sentido === "debo" ? `Pago a ${elegida.persona}` : `Cobro de ${elegida.persona}`}
                enlace={{ href: `/deudas/${elegida.id}`, texto: "Ver deuda" }}
              />
              <Saldar
                deuda={elegida}
                sobres={sobres}
                categorias={categorias}
                porAsignar={porAsignar}
                cuentas={cuentas}
                hoy={hoy}
              />
            </>
          ) : (
            <>
              <EncabezadoTarjeta titulo="Registrar" />
              <p className="text-[13px] text-texto-3">
                {abiertas.length > 0 ? "Elige una deuda para pagarla o cobrarla." : "No hay deudas abiertas."}
              </p>
            </>
          )}
        </Tarjeta>
      </div>
    </main>
  );
}
