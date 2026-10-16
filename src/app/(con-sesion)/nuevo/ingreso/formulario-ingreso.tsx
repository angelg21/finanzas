"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import { Boton, Campo, CampoMonto, Entrada, SelectorPildoras } from "@/components/formulario";
import { IconoSobre } from "@/components/icono-sobre";
import { TarjetaReparto } from "@/components/reparto";
import { Tarjeta } from "@/components/ui";
import { type Moneda, aCentavos, partesCentavos, unidadDe } from "@/lib/dinero";
import { esFecha, fechaDesdeAtajo } from "@/lib/fechas";
import { type ReglaConSaldo, type RecibidoPorMes, camposDePropuesta, recibidoDelMes } from "@/lib/ingresos";
import { pistaDeCuota } from "@/lib/cuota-deudas";
import { pistaDeRegla } from "@/lib/reglas";
import type { NivelDeSobre } from "@/lib/sobres";
import { registrarConFallas } from "./registrar-con-fallas";
import { ResumenIngreso } from "./resumen-ingreso";
import { type ErroresFormularioIngreso, type EstadoIngreso, type ValoresIngreso, claveDePropuesta } from "./valores";

export type CuentaIngreso = { id: number; nombre: string; moneda: Moneda; esPropia: boolean };
type Datos = {
  cuentas: CuentaIngreso[];
  categorias: { id: number; nombre: string; icono: string; color: string }[];
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
type Inicial = { cuentaId: string; categoriaId: string; idCaptura: string };

/** El monto tecleado en centavos, o null si todavía no es un monto mayor que cero. */
function centavosDe(texto: string): number | null {
  try {
    const centavos = aCentavos(texto);
    return centavos > 0 ? centavos : null;
  } catch {
    return null;
  }
}

/** Registro de un ingreso con su reparto. "Registrar otro" lo vuelve a montar con la misma cuenta. */
export function FormularioIngreso({ inicial, ...datos }: Datos & { inicial: Inicial }) {
  const [captura, setCaptura] = useState({ numero: 0, ...inicial });
  return (
    <Captura
      key={captura.numero}
      {...datos}
      inicial={captura}
      alRegistrarOtro={(cuentaId, idCaptura) =>
        setCaptura((c) => ({ ...c, numero: c.numero + 1, cuentaId, idCaptura }))
      }
    />
  );
}

function Captura({
  inicial,
  alRegistrarOtro,
  ...datos
}: Datos & { inicial: Inicial; alRegistrarOtro: (cuentaId: string, idCaptura: string) => void }) {
  const [estado, enviar, pendiente] = useActionState<EstadoIngreso, FormData>(registrarConFallas, {
    ronda: 0,
    estado: "inicial",
  });

  if (estado.estado === "guardado") {
    return (
      <ResumenIngreso
        resumen={estado.resumen}
        cuentaId={estado.cuentaId}
        alRegistrarOtro={() => alRegistrarOtro(estado.cuentaId, estado.siguienteCaptura)}
      />
    );
  }

  const valores: ValoresIngreso =
    estado.estado === "inicial"
      ? {
          monto: "",
          cuentaId: inicial.cuentaId,
          categoriaId: inicial.categoriaId,
          // "Hoy" como atajo, no como la fecha de hoy: se resuelve al guardar.
          fecha: "hoy",
          nota: "",
          idCaptura: inicial.idCaptura,
          propuestaDe: "",
          asignaciones: {},
        }
      : estado.valores;

  return (
    // Con la ronda como key los campos se montan de nuevo con lo tecleado tras cada respuesta.
    <Campos
      key={estado.ronda}
      {...datos}
      valores={valores}
      errores={estado.estado === "error" ? estado.errores : {}}
      sinAsignarPorConfirmar={estado.estado === "confirmar" ? estado.sinAsignarCentavos : null}
      propuesto={estado.estado === "proponer"}
      primeraVez={estado.ronda === 0}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  cuentas,
  categorias,
  reglas,
  recibidoPorMes,
  hoy,
  valores,
  errores,
  sinAsignarPorConfirmar,
  propuesto,
  primeraVez,
  enviar,
  pendiente,
}: Datos & {
  valores: ValoresIngreso;
  errores: ErroresFormularioIngreso;
  sinAsignarPorConfirmar: number | null;
  propuesto: boolean;
  primeraVez: boolean;
  enviar: (formData: FormData) => void;
  pendiente: boolean;
}) {
  const [cuentaId, setCuentaId] = useState(valores.cuentaId);
  const [monto, setMonto] = useState(valores.monto);
  const [fecha, setFecha] = useState(valores.fecha);
  const [asignaciones, setAsignaciones] = useState(valores.asignaciones);
  const [propuestaDe, setPropuestaDe] = useState(valores.propuestaDe);

  const resuelta = fechaDesdeAtajo(fecha, hoy);
  const delMes = recibidoDelMes(recibidoPorMes, esFecha(resuelta) ? resuelta : hoy);
  const montoCentavos = centavosDe(monto);

  /** Con JavaScript la propuesta sigue al monto y a la fecha, y el primer clic ya guarda (criterio 13). */
  function proponer(nuevoMonto: string, nuevaFecha: string) {
    const centavos = centavosDe(nuevoMonto);
    const dia = fechaDesdeAtajo(nuevaFecha, hoy);
    setAsignaciones(centavos === null || !esFecha(dia) ? {} : camposDePropuesta(centavos, dia, reglas, recibidoPorMes));
    setPropuestaDe(claveDePropuesta(nuevoMonto, nuevaFecha));
  }

  const monedaDe = (id: string) => cuentas.find((c) => String(c.id) === id)?.moneda ?? "USD";
  const confirmando = sinAsignarPorConfirmar !== null;

  return (
    // En escritorio, el formulario en 7 columnas y el reparto en 5 a su lado, como el "Antes y después" del gasto; el
    // botón va bajo el formulario. En el celular, uno debajo del otro y el botón al final.
    <form
      action={enviar}
      className="flex flex-col gap-4 lg:col-span-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5"
    >
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />
      <input type="hidden" name="propuestaDe" value={propuestaDe} />
      <Tarjeta className="lg:col-span-7 lg:row-start-1">
        <div className="flex flex-col gap-5">
          <Campo etiqueta="Monto" error={errores.monto}>
            <CampoMonto
              name="monto"
              unidad={unidadDe(monedaDe(cuentaId))}
              defaultValue={valores.monto}
              onChange={(e) => {
                setMonto(e.target.value);
                proponer(e.target.value, fecha);
              }}
              autoFocus={primeraVez || errores.monto !== undefined}
              aria-invalid={errores.monto ? true : undefined}
            />
          </Campo>

          <SelectorPildoras
            etiqueta="Cuenta"
            name="cuentaId"
            envolver
            opciones={cuentas.map((c) => ({
              valor: String(c.id),
              texto: c.nombre,
              detalle: c.esPropia ? undefined : "a nombre de mi prima",
            }))}
            valorInicial={valores.cuentaId}
            onCambio={setCuentaId}
            error={errores.cuenta}
          />

          <SelectorPildoras
            etiqueta="Categoría"
            name="categoriaId"
            envolver
            opciones={categorias.map((c) => ({
              valor: String(c.id),
              texto: c.nombre,
              categoria: { icono: c.icono, color: c.color },
            }))}
            valorInicial={valores.categoriaId}
            error={errores.categoria}
          />

          <SelectorFecha
            name="fecha"
            valor={fecha}
            hoy={hoy}
            onCambio={(f) => {
              setFecha(f);
              proponer(monto, f);
            }}
            error={errores.fecha}
          />

          <Campo etiqueta="Nota">
            <Entrada
              name="nota"
              placeholder="Opcional"
              maxLength={200}
              autoComplete="off"
              defaultValue={valores.nota}
            />
          </Campo>
        </div>
      </Tarjeta>

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
        montoCentavos={montoCentavos}
        onCambio={(sobreId, valor) => setAsignaciones((a) => ({ ...a, [sobreId]: valor }))}
        error={errores.reparto}
        enlace={{ href: "/sobres/reglas", texto: "Reglas" }}
        vacio="Sin reglas de reparto: el ingreso quedará entero en Por asignar."
        className="lg:sticky lg:top-24 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1"
      />

      <div className="flex flex-col gap-3 lg:col-span-7 lg:col-start-1 lg:row-start-2">
        {propuesto ? (
          <p role="status" className="text-[13px] font-semibold text-texto-2">
            Revisa el reparto y vuelve a tocar el botón para guardarlo.
          </p>
        ) : null}
        {confirmando ? (
          <p role="alert" className="flex items-start gap-2 text-[13px] font-semibold text-negativo">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            Quedan {partesCentavos(sinAsignarPorConfirmar).numero} en Por asignar. ¿Guardar así?
            <input type="hidden" name="confirmarSinAsignar" value={sinAsignarPorConfirmar} />
          </p>
        ) : null}
        {errores.general ? (
          <p role="alert" className="text-[13px] font-semibold text-negativo">
            {errores.general}
          </p>
        ) : null}
        <Boton type="submit" disabled={pendiente} autoFocus={confirmando} className="w-full">
          {pendiente
            ? "Guardando…"
            : confirmando
              ? `Sí, dejar ${partesCentavos(sinAsignarPorConfirmar).numero} en Por asignar`
              : "Registrar y repartir"}
        </Boton>
      </div>
    </form>
  );
}
