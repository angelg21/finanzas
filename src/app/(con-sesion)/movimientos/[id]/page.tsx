import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta } from "@/components/ui";
import {
  categoriasDeGastoPorUso,
  cuentaPorDefectoParaGasto,
  cuentaPorDefectoParaVenta,
  saldosPorCuenta,
  sobresParaGasto,
} from "@/db/consultas";
import {
  type MovimientoParaEditar,
  type PagoOCobro,
  movimientoParaEditar,
  pagoOCobroParaDeshacer,
  vistaPreviaDeBorrado,
} from "@/db/editar-movimientos";
import { todasLasEtiquetas } from "@/db/etiquetas";
import { categoriasDeIngresoPorUso } from "@/db/reparto";
import { centavosATexto, formatearCentavos, formatearCifra, formatearTasaGuardada } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import type { FormaPago } from "@/lib/gastos";
import { exigirSesion } from "@/app/sesion";
import { BotonBorrar, ConfirmarBorrado } from "./borrar-movimiento";
import { FormularioEditarGasto } from "./formulario-editar-gasto";
import { FormularioEditarIngreso } from "./formulario-editar-ingreso";
import { destinoDeVuelta } from "./valores";

export const metadata: Metadata = { title: "Editar movimiento" };
export const dynamic = "force-dynamic";

/** "241.8000" → "241,8": la tasa guardada como se escribe en su campo. */
const tasaParaCampo = (tasa: string | null) => (tasa ? formatearTasaGuardada(tasa).replace(/ Bs\/USD$/, "") : "");

/**
 * Editar o borrar un gasto o un ingreso (spec 006). Solo esos dos tipos: lo demás responde 404 (criterio 8). Con
 * `?borrar=1`, sin JavaScript, la confirmación de borrar va en la página; con él, en un `<dialog>`.
 */
export default async function EditarMovimiento({ params, searchParams }: PageProps<"/movimientos/[id]">) {
  await exigirSesion();
  const { id } = await params;
  const { borrar, volver: pedido } = await searchParams;
  const movimientoId = Number(id);
  if (!Number.isSafeInteger(movimientoId) || movimientoId <= 0) notFound();
  const volver = destinoDeVuelta(typeof pedido === "string" ? pedido : "");
  const m = await movimientoParaEditar(movimientoId);
  if (!m) {
    // Spec 007: un pago o un cobro de una deuda no se edita, se deshace.
    const p = await pagoOCobroParaDeshacer(movimientoId);
    if (!p) notFound();
    return <DeshacerPagoOCobro p={p} volver={volver} confirmar={borrar === "1"} />;
  }
  const hoy = hoyEnCaracas(new Date());
  const esGasto = m.movimiento.tipo === "gasto";

  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-2 px-1 lg:col-span-12 lg:px-0">
        <Link href={volver} className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto">
          <ArrowLeft size={16} aria-hidden />
          {etiquetaDeVuelta(volver)}
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight">{esGasto ? "Editar gasto" : "Editar ingreso"}</h1>
      </header>
      {esGasto ? (
        <EdicionDeGasto m={m} volver={volver} hoy={hoy} confirmar={borrar === "1"} />
      ) : (
        <EdicionDeIngreso m={m} volver={volver} hoy={hoy} confirmar={borrar === "1"} />
      )}
    </main>
  );
}

const etiquetaDeVuelta = (volver: string) =>
  volver === "/" ? "Inicio" : volver.startsWith("/deudas/") ? "Deuda" : "Movimientos";

/** Un pago o un cobro (spec 007, criterios 1 y 2): lo que fue, y "Deshacer" con su confirmación. */
function DeshacerPagoOCobro({ p, volver, confirmar }: { p: PagoOCobro; volver: string; confirmar: boolean }) {
  const esPago = p.tipo === "pago_deuda";
  const titulo = `${esPago ? "Pago a" : "Cobro de"} ${p.persona}`;
  const monto = formatearCentavos(p.montoCentavos, p.moneda);
  const deshacer = {
    id: p.id,
    tipo: esPago ? ("pago" as const) : ("cobro" as const),
    volver,
    queSeBorra: esPago
      ? `Se deshace el pago de ${monto} a ${p.persona}: vuelve a la cuenta y al sobre Deudas, y la deuda vuelve a deberse.`
      : `Se deshace el cobro de ${monto} de ${p.persona}: sale de la cuenta y de Por asignar, y vuelve a deberte.`,
    avisos: [],
  };
  return (
    <main className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <header className="flex flex-col gap-2 px-1 lg:col-span-12 lg:px-0">
        <Link href={volver} className="flex items-center gap-1 text-[13px] font-semibold text-enlace hover:text-texto">
          <ArrowLeft size={16} aria-hidden />
          {etiquetaDeVuelta(volver)}
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight">{titulo}</h1>
      </header>
      <div className="flex flex-col gap-4 lg:col-span-6 lg:col-start-4">
        {confirmar ? (
          <Tarjeta>
            <ConfirmarBorrado {...deshacer} />
          </Tarjeta>
        ) : null}
        <Tarjeta>
          <p className="text-[28px] font-extrabold tracking-tight">{monto}</p>
          <p className="mt-1 text-[13px] text-texto-2">
            {[p.cuenta, p.fecha.split("-").reverse().join("-"), p.nota].filter(Boolean).join(" · ")}
          </p>
        </Tarjeta>
        <div className="flex">
          <BotonBorrar {...deshacer} />
        </div>
      </div>
    </main>
  );
}

type Props = { m: MovimientoParaEditar; volver: string; hoy: string; confirmar: boolean };

async function EdicionDeGasto({ m, volver, hoy, confirmar }: Props) {
  const [categorias, sobres, cuentas, cuentaPorDefecto, cuentaVentaPorDefecto, etiquetas] = await Promise.all([
    categoriasDeGastoPorUso(),
    sobresParaGasto(),
    saldosPorCuenta(),
    cuentaPorDefectoParaGasto(),
    cuentaPorDefectoParaVenta(),
    todasLasEtiquetas(),
  ]);
  const g = m.movimiento;
  const forma: FormaPago = m.venta ? "vendiendo" : g.moneda === "VES" ? "saldo" : "dolares";
  const borrado = {
    id: g.id,
    tipo: "gasto" as const,
    volver,
    queSeBorra: m.venta
      ? `Se borran el gasto de ${formatearCentavos(g.montoCentavos, g.moneda)} y la venta de ${formatearCentavos(m.venta.montoCentavos, m.venta.moneda)}.`
      : `Se borra el gasto de ${formatearCentavos(g.montoCentavos, g.moneda)}.`,
    avisos: [],
  };
  return (
    <>
      {confirmar ? (
        <Tarjeta className="lg:col-span-7">
          <ConfirmarBorrado {...borrado} />
        </Tarjeta>
      ) : null}
      <FormularioEditarGasto
        id={g.id}
        volver={volver}
        categorias={categorias.map(({ id, nombre, icono, color }) => ({ id, nombre, icono, color }))}
        etiquetas={etiquetas}
        sobres={sobres.map(({ id, nombre, tipo, saldoCentavos, topeCentavos }) => ({
          id,
          nombre,
          tipo,
          saldoCentavos,
          topeCentavos,
        }))}
        cuentas={cuentas.map(({ id, nombre, moneda, esPropia, saldoCentavos }) => ({
          id,
          nombre,
          moneda,
          esPropia,
          saldoCentavos,
        }))}
        hoy={hoy}
        inicial={{
          forma,
          monto: centavosATexto(g.montoCentavos),
          tasa: tasaParaCampo(g.tasa),
          vendido: m.venta ? centavosATexto(m.venta.montoCentavos) : "",
          cuentaId: String(forma === "dolares" ? g.cuentaOrigenId : (cuentaPorDefecto ?? "")),
          cuentaVentaId: String(m.venta?.cuentaOrigenId ?? cuentaVentaPorDefecto ?? ""),
          categoriaId: String(g.categoriaId ?? ""),
          sobreId: String(g.sobreOrigenId ?? ""),
          fecha: g.fecha,
          nota: g.nota ?? "",
          idCaptura: m.captura ?? "",
          etiquetaId: String(g.etiquetaId ?? ""),
          etiquetaNueva: "",
        }}
      />
      <div className="flex lg:col-span-7">
        <BotonBorrar {...borrado} />
      </div>
    </>
  );
}

async function EdicionDeIngreso({ m, volver, hoy, confirmar }: Props) {
  const [categorias, cuentas, previa, etiquetas] = await Promise.all([
    categoriasDeIngresoPorUso(),
    saldosPorCuenta(),
    vistaPreviaDeBorrado(m),
    todasLasEtiquetas(),
  ]);
  const i = m.movimiento;
  const reparto = previa?.reparto ?? [];
  const repartido = reparto.length
    ? `Se repartió: ${reparto.map((r) => `${r.nombre} ${formatearCifra(r.montoUsdCentavos)}`).join(" · ")}. El reparto no cambia al editar.`
    : null;
  const borrado = {
    id: i.id,
    tipo: "ingreso" as const,
    volver,
    queSeBorra: m.reparto.length
      ? `Se borran el ingreso de ${formatearCentavos(i.montoCentavos, i.moneda)} y su reparto.`
      : `Se borra el ingreso de ${formatearCentavos(i.montoCentavos, i.moneda)}.`,
    avisos: previa?.plan.ok ? previa.plan.avisos : [],
    impedido: previa && !previa.plan.ok ? previa.plan.error : undefined,
  };
  return (
    <div className="flex flex-col gap-4 lg:col-span-6 lg:col-start-4">
      {confirmar ? (
        <Tarjeta>
          <ConfirmarBorrado {...borrado} />
        </Tarjeta>
      ) : null}
      <Tarjeta>
        <FormularioEditarIngreso
          id={i.id}
          volver={volver}
          inicial={{
            monto: centavosATexto(i.montoCentavos),
            cuentaId: String(i.cuentaDestinoId ?? ""),
            categoriaId: String(i.categoriaId ?? ""),
            fecha: i.fecha,
            nota: i.nota ?? "",
            etiquetaId: String(i.etiquetaId ?? ""),
            etiquetaNueva: "",
          }}
          cuentas={cuentas.filter((c) => c.moneda !== "VES").map(({ id, nombre, moneda }) => ({ id, nombre, moneda }))}
          categorias={categorias.map(({ id, nombre, icono, color }) => ({ id, nombre, icono, color }))}
          etiquetas={etiquetas}
          reparto={repartido}
          hoy={hoy}
        />
      </Tarjeta>
      <div className="flex">
        <BotonBorrar {...borrado} />
      </div>
    </div>
  );
}
