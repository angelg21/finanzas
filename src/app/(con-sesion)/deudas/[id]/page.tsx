import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, CircleAlert, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnlaceBoton } from "@/components/formulario";
import { FilaMovimiento } from "@/components/movimiento";
import { Cifra, EncabezadoTarjeta, Pildora, Progreso, Tarjeta } from "@/components/ui";
import { saldosPorCuenta } from "@/db/consultas";
import { deudaConMovimientos, deudasConPendiente, sobreDeudas } from "@/db/deudas";
import { sobrePorAsignar } from "@/db/reparto";
import { cuentaParaPagar } from "@/lib/deudas";
import { centavosATexto, formatearCifra } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import { avisosDeLiquidez } from "@/lib/liquidez";
import { plazoDeDeuda } from "@/lib/plazos";
import { FormularioPago } from "./formulario-pago";
import { exigirSesion } from "@/app/sesion";

export const metadata: Metadata = { title: "Deuda" };
export const dynamic = "force-dynamic";

/**
 * Una deuda (spec 005): lo pendiente, de cuánto, lo pagado o cobrado, la fecha y la cuenta prevista, el aviso de
 * liquidez, el formulario para pagarla o cobrarla y su historial. Saldada, el formulario se cambia por "Pagada" o
 * "Cobrada". En escritorio el formulario va a la derecha, fijo al desplazarse, como el reparto del ingreso.
 */
export default async function DetalleDeuda({ params, searchParams }: PageProps<"/deudas/[id]">) {
  await exigirSesion();
  const { id } = await params;
  const { guardado } = await searchParams;
  const deudaId = Number(id);
  if (!Number.isSafeInteger(deudaId) || deudaId <= 0) notFound();
  const [datos, sobre, porAsignar, cuentas, todas] = await Promise.all([
    deudaConMovimientos(deudaId),
    sobreDeudas(),
    sobrePorAsignar(),
    saldosPorCuenta(),
    deudasConPendiente(),
  ]);
  if (!datos) notFound();
  const { deuda, historial } = datos;
  const hoy = hoyEnCaracas(new Date());
  const debo = deuda.sentido === "debo";
  const total = deuda.montoInicialCentavos + deuda.prestadoCentavos;
  const aviso = avisosDeLiquidez({ deudas: todas, cuentas }).get(deuda.id);
  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const cuentaInicial = cuentaParaPagar(deuda.cuentaPrevistaId, enDolares);
  const pagada = deuda.estado === "pagada";

  return (
    // La última fila absorbe el alto del formulario, que abarca dos: sin ella quedaría un hueco bajo el hero.
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-5">
      <div className="flex items-center justify-between lg:col-span-12">
        <Link href="/deudas" className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto">
          <ArrowLeft size={16} aria-hidden />
          Deudas
        </Link>
        <Link
          href={`/deudas/${deuda.id}/editar`}
          className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto"
        >
          <Pencil size={14} aria-hidden />
          Editar
        </Link>
      </div>

      <section className="hero rounded-tarjeta p-5 lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:p-6">
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
          <Pildora tono="hero">{plazoDeDeuda(deuda.fechaPrevista, hoy)}</Pildora>
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
        {aviso?.texto ? (
          <div className="mt-4">
            <Pildora tono="negativa">
              <CircleAlert size={13} aria-hidden className="shrink-0" />
              {aviso.texto}
            </Pildora>
          </div>
        ) : null}
      </section>

      <Tarjeta className="lg:sticky lg:top-24 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-2">
        <EncabezadoTarjeta
          titulo={debo ? "Registrar pago" : "Registrar cobro"}
          derecha={
            guardado === "pago" || guardado === "cobro" || guardado === "prestamo" ? (
              <Pildora tono="positiva">
                <CheckCircle2 size={13} aria-hidden />
                {{ pago: "Pago guardado", cobro: "Cobro guardado", prestamo: "Préstamo guardado" }[guardado]}
              </Pildora>
            ) : undefined
          }
        />
        {guardado === "cobro" ? (
          // Lo cobrado entró a "Por asignar": se ofrece repartirlo (criterio 5).
          <div className="mb-4 flex flex-col gap-2 rounded-[14px] bg-tarjeta-hover p-3">
            <p className="text-[13px] text-texto-2">Lo cobrado entró a Por asignar. Dale un trabajo:</p>
            <EnlaceBoton href="/sobres/repartir" variante="secundario">
              Repartir
            </EnlaceBoton>
          </div>
        ) : null}
        {pagada ? (
          <Pildora tono="positiva">
            <CheckCircle2 size={13} aria-hidden />
            {debo ? "Pagada" : "Cobrada"}
          </Pildora>
        ) : debo && !sobre?.activo ? (
          <p className="text-[13px] text-negativo">No hay un sobre Deudas activo: no se puede pagar.</p>
        ) : !debo && !porAsignar?.activo ? (
          <p className="text-[13px] text-negativo">No hay un sobre Por asignar activo: no se puede cobrar.</p>
        ) : enDolares.length === 0 ? (
          <p className="text-[13px] text-negativo">No hay ninguna cuenta en dólares activa.</p>
        ) : (
          <FormularioPago
            cual={debo ? "pago" : "cobro"}
            inicial={{
              deudaId: String(deuda.id),
              idCaptura: crypto.randomUUID(),
              monto: centavosATexto(deuda.pendienteCentavos),
              cuentaId: cuentaInicial === null ? "" : String(cuentaInicial),
              fecha: "hoy",
              nota: "",
            }}
            cuentas={enDolares.map(({ id: cuentaId, nombre, moneda }) => ({ id: cuentaId, nombre, moneda }))}
            hoy={hoy}
            saldoDeudasCentavos={debo && sobre ? sobre.saldoCentavos : null}
          />
        )}
      </Tarjeta>

      <Tarjeta className="lg:col-span-7 lg:col-start-1 lg:row-start-3">
        <EncabezadoTarjeta titulo="Historial" />
        {historial.length === 0 ? (
          <p className="text-[13px] text-texto-3">Todavía no hay pagos, préstamos ni cobros.</p>
        ) : (
          <div className="flex flex-col divide-y divide-tarjeta-borde">
            {historial.map((m) => (
              <FilaMovimiento key={m.id} m={m} />
            ))}
          </div>
        )}
      </Tarjeta>
    </main>
  );
}
