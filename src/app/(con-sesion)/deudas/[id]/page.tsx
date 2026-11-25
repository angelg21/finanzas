import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, CircleAlert, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilaMovimiento } from "@/components/movimiento";
import { Cifra, EncabezadoTarjeta, Pildora, Progreso, Tarjeta } from "@/components/ui";
import { AvisoPasajero } from "@/components/aviso-pasajero";
import { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaPagar } from "@/db/consultas";
import { deudaConMovimientos, deudasConPendiente } from "@/db/deudas";
import { sobrePorAsignar } from "@/db/reparto";
import { formatearCifra } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import { avisosDeLiquidez } from "@/lib/liquidez";
import { plazoDeDeuda } from "@/lib/plazos";
import type { Guardado } from "./formulario-pago";
import { Saldar } from "./saldar";
import { exigirSesion } from "@/app/sesion";
import { avisoDeVuelta, enlaceDeEdicion } from "../../movimientos/[id]/valores";

export const metadata: Metadata = { title: "Deuda" };
export const dynamic = "force-dynamic";

/** Los valores de `?guardado=` que traen aviso; cualquier otro se ignora. */
const guardados: readonly Guardado[] = ["pago", "cobro", "prestamo"];

/**
 * Una deuda (spec 005): lo pendiente, de cuánto, lo pagado o cobrado, la fecha y la cuenta prevista, el aviso de
 * liquidez después del hero, el formulario para pagarla o cobrarla y su historial. Saldada, el formulario se cambia
 * por "Pagada" o "Cobrada", y el hero lo dice en vez del plazo. En escritorio el formulario va a la derecha, fijo al
 * desplazarse, como el reparto del ingreso.
 */
export default async function DetalleDeuda({ params, searchParams }: PageProps<"/deudas/[id]">) {
  await exigirSesion();
  const { id } = await params;
  const parametros = await searchParams;
  const { guardado: deLaDireccion } = parametros;
  const deshecho = avisoDeVuelta(parametros);
  const guardado = guardados.find((g) => g === deLaDireccion);
  const deudaId = Number(id);
  if (!Number.isSafeInteger(deudaId) || deudaId <= 0) notFound();
  const [datos, sobres, categorias, porAsignar, cuentas, todas] = await Promise.all([
    deudaConMovimientos(deudaId),
    sobresParaPagar(),
    categoriasDeGastoPorUso(),
    sobrePorAsignar(),
    saldosPorCuenta(),
    deudasConPendiente(),
  ]);
  if (!datos) notFound();
  const { deuda, historial } = datos;
  const hoy = hoyEnCaracas(new Date());
  const debo = deuda.sentido === "debo";
  const saldada = deuda.estado === "pagada";
  const total = deuda.montoInicialCentavos + deuda.prestadoCentavos;
  const aviso = avisosDeLiquidez({ deudas: todas, cuentas }).get(deuda.id);

  return (
    // La última fila absorbe el alto del formulario, que abarca dos: sin ella quedaría un hueco bajo el hero.
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-5">
      <div className="flex items-center justify-between lg:col-span-12">
        <Link href="/deudas" className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto">
          <ArrowLeft size={16} aria-hidden />
          Deudas
        </Link>
        {deshecho ? (
          <AvisoPasajero parametros={["borrado"]}>
            <Pildora tono="positiva">
              <CheckCircle2 size={13} aria-hidden />
              {deshecho}
            </Pildora>
          </AvisoPasajero>
        ) : null}
        <Link
          href={`/deudas/${deuda.id}/editar`}
          className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto"
        >
          <Pencil size={14} aria-hidden />
          Editar
        </Link>
      </div>

      {/* El aviso de liquidez va después del hero, sobre el fondo de la página: dentro, el rojo no se leía. */}
      <div className="flex flex-col gap-4 lg:col-span-7 lg:col-start-1 lg:row-start-2">
        <section className="hero rounded-tarjeta p-5 lg:p-6">
          <h1 className="truncate text-[20px] font-bold">{deuda.persona}</h1>
          <p className="text-[13px] text-white/75">{debo ? "Le debo" : "Me debe"}</p>
          <div className="mt-4">
            <Cifra centavos={deuda.pendienteCentavos} tamano="hero" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pildora tono="hero">De {formatearCifra(total)}</Pildora>
            <Pildora tono="hero">
              {debo ? "Pagado" : "Cobrado"} {formatearCifra(deuda.saldadoCentavos)}
            </Pildora>
            <Pildora tono="hero">
              {saldada ? (debo ? "Pagada" : "Cobrada") : plazoDeDeuda(deuda.fechaPrevista, hoy)}
            </Pildora>
            {deuda.cuentaPrevista ? (
              <Pildora tono="hero">
                {deuda.cuentaPrevista} {deuda.monedaPrevista}
              </Pildora>
            ) : null}
          </div>
          {total > 0 ? (
            <div className="mt-4">
              <Progreso valor={deuda.saldadoCentavos / total} />
              <p className="mt-2 text-[12px] text-white/75">
                {Math.floor((deuda.saldadoCentavos * 100) / total)} % {debo ? "pagado" : "cobrado"}
              </p>
            </div>
          ) : null}
        </section>
        {aviso?.texto ? (
          <div>
            <Pildora tono="negativa">
              <CircleAlert size={13} aria-hidden className="shrink-0" />
              {aviso.texto}
            </Pildora>
          </div>
        ) : null}
      </div>

      <Tarjeta className="lg:sticky lg:top-24 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-2">
        <EncabezadoTarjeta titulo={debo ? "Registrar pago" : "Registrar cobro"} />
        <Saldar
          deuda={deuda}
          sobres={sobres}
          categorias={categorias}
          porAsignar={porAsignar}
          cuentas={cuentas}
          hoy={hoy}
          guardado={guardado}
        />
      </Tarjeta>

      <Tarjeta className="lg:col-span-7 lg:col-start-1 lg:row-start-3">
        <EncabezadoTarjeta titulo="Historial" />
        {historial.length === 0 ? (
          <p className="text-[13px] text-texto-3">Todavía no hay pagos, préstamos ni cobros.</p>
        ) : (
          <div className="flex flex-col divide-y divide-tarjeta-borde">
            {historial.map((m) => (
              <FilaMovimiento key={m.id} m={m} href={enlaceDeEdicion(m, `/deudas/${deuda.id}`)} />
            ))}
          </div>
        )}
      </Tarjeta>
    </main>
  );
}
