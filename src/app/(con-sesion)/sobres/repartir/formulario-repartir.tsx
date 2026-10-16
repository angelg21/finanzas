"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { Boton, EnlaceBoton } from "@/components/formulario";
import { IconoSobre } from "@/components/icono-sobre";
import { TarjetaReparto } from "@/components/reparto";
import { Cifra, Tarjeta } from "@/components/ui";
import { formatearCentavos, partesCentavos } from "@/lib/dinero";
import { type RecibidoPorMes, type ReglaConSaldo, recibidoDelMes } from "@/lib/ingresos";
import { pistaDeCuota } from "@/lib/cuota-deudas";
import { pistaDeRegla } from "@/lib/reglas";
import type { NivelDeSobre } from "@/lib/sobres";
import { repartirConFallas } from "./repartir-con-fallas";
import type { ErroresRepartir, EstadoRepartir, ValoresRepartir } from "./valores";

type Datos = {
  saldoCentavos: number;
  reglas: (ReglaConSaldo & {
    nombre: string;
    tipoSobre: string;
    nivel: NivelDeSobre;
    /** Solo la de Deudas, cuya cuota se calcula (spec 005). */
    cuota?: { vencimiento: string | null; hoy: string };
  })[];
  recibidoPorMes: RecibidoPorMes;
  hoy: string;
};

/** El reparto de lo que hay en "Por asignar", con la propuesta ya escrita en cada campo. */
export function FormularioRepartir({ inicial, ...datos }: Datos & { inicial: ValoresRepartir }) {
  const [estado, enviar, pendiente] = useActionState<EstadoRepartir, FormData>(repartirConFallas, {
    ronda: 0,
    estado: "inicial",
  });

  if (estado.estado === "guardado") {
    return (
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <div role="status" className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-positivo">
            <CheckCircle2 size={18} aria-hidden />
            Reparto guardado
          </p>
          <ul className="flex flex-col divide-y divide-tarjeta-borde">
            {estado.repartido.map((r) => (
              <li key={r.nombre} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-[13px] font-extrabold uppercase tracking-wide">{r.nombre}</span>
                <Cifra centavos={r.centavos} />
              </li>
            ))}
          </ul>
          {estado.quedanCentavos > 0 ? (
            <p className="text-[13px] font-semibold text-texto-2">
              Quedan {formatearCentavos(estado.quedanCentavos)} en Por asignar.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <EnlaceBoton href="/sobres" autoFocus className="sm:flex-1">
              Ir a sobres
            </EnlaceBoton>
            <EnlaceBoton href="/" variante="secundario" className="sm:flex-1">
              Ir al inicio
            </EnlaceBoton>
          </div>
        </div>
      </Tarjeta>
    );
  }

  if (datos.saldoCentavos <= 0) {
    return (
      <Tarjeta className="lg:col-span-6 lg:col-start-4">
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-texto-2">No hay nada por repartir: cada dólar ya tiene un sobre.</p>
          <EnlaceBoton href="/sobres" variante="secundario">
            Ir a sobres
          </EnlaceBoton>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Campos
      key={estado.ronda}
      {...datos}
      // Si el saldo cambió desde que se abrió la pantalla, el pie suma contra el de ahora.
      saldoCentavos={estado.estado === "error" ? (estado.saldoCentavos ?? datos.saldoCentavos) : datos.saldoCentavos}
      valores={estado.estado === "inicial" ? inicial : estado.valores}
      errores={estado.estado === "error" ? estado.errores : {}}
      sinAsignarPorConfirmar={estado.estado === "confirmar" ? estado.sinAsignarCentavos : null}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  saldoCentavos,
  reglas,
  recibidoPorMes,
  hoy,
  valores,
  errores,
  sinAsignarPorConfirmar,
  enviar,
  pendiente,
}: Datos & {
  valores: ValoresRepartir;
  errores: ErroresRepartir;
  sinAsignarPorConfirmar: number | null;
  enviar: (formData: FormData) => void;
  pendiente: boolean;
}) {
  const [asignaciones, setAsignaciones] = useState(valores.asignaciones);
  const delMes = recibidoDelMes(recibidoPorMes, hoy);
  const confirmando = sinAsignarPorConfirmar !== null;

  return (
    <form action={enviar} className="flex flex-col gap-4 lg:col-span-6 lg:col-start-4">
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />
      <TarjetaReparto
        filas={reglas.map((r) => ({
          sobreId: r.sobreId,
          nombre: r.nombre,
          icono: <IconoSobre clave={r.sobreId} tipo={r.tipoSobre} nivel={r.nivel} tamano="sm" superficie="palida" />,
          pista: r.cuota
            ? pistaDeCuota(r.valor, delMes[r.sobreId] ?? 0, r.cuota.vencimiento, r.cuota.hoy)
            : pistaDeRegla(r, delMes[r.sobreId] ?? 0, r.saldoCentavos),
          valor: asignaciones[r.sobreId] ?? "",
          error: errores.sobres?.[r.sobreId],
        }))}
        montoCentavos={saldoCentavos}
        onCambio={(sobreId, valor) => setAsignaciones((a) => ({ ...a, [sobreId]: valor }))}
        error={errores.reparto}
        enlace={{ href: "/sobres/reglas", texto: "Reglas" }}
        vacio="Sin reglas de reparto: defínelas en Reglas para repartir desde aquí."
      />
      {confirmando ? (
        <p role="alert" className="flex items-start gap-2 text-[13px] font-semibold text-negativo">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          Quedan {partesCentavos(sinAsignarPorConfirmar).numero} en Por asignar. ¿Repartir así?
          <input type="hidden" name="confirmarSinAsignar" value={sinAsignarPorConfirmar} />
        </p>
      ) : null}
      {errores.general ? (
        <p role="alert" className="text-[13px] font-semibold text-negativo">
          {errores.general}
        </p>
      ) : null}
      <Boton type="submit" disabled={pendiente || reglas.length === 0} autoFocus={confirmando} className="w-full">
        {pendiente
          ? "Guardando…"
          : confirmando
            ? `Sí, dejar ${partesCentavos(sinAsignarPorConfirmar).numero} en Por asignar`
            : "Repartir"}
      </Boton>
    </form>
  );
}
