"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import { Boton, Campo, CampoMonto, EnlaceBoton, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { AvisoPasajero } from "@/components/aviso-pasajero";
import { Pildora } from "@/components/ui";
import { avisoDelSobreDeudas } from "@/lib/deudas";
import { montoPositivo, unidadDe } from "@/lib/dinero";
import { cobrarConFallas, pagarConFallas } from "./pagar-con-fallas";
import type { ErroresFormularioPago, EstadoPago, ValoresPago } from "./valores";

/** Lo que se acaba de guardar en esta deuda, de `?guardado=`. */
export type Guardado = "pago" | "cobro" | "prestamo";

const textoGuardado = { pago: "Pago guardado", cobro: "Cobro guardado", prestamo: "Préstamo guardado" };

/**
 * "Pago guardado", o "Cobro guardado" con la oferta de repartir lo cobrado, que entró a "Por asignar" (criterio 5). Se
 * va de la dirección al mostrarse y al enviar otro formulario (revisión de la 007, segunda vuelta, hallazgo 4).
 */
export function AvisoGuardado({ guardado }: { guardado: Guardado }) {
  return (
    <AvisoPasajero parametros={["guardado"]} className="flex flex-col gap-3">
      <div>
        <Pildora tono="positiva">
          <CheckCircle2 size={13} aria-hidden />
          {textoGuardado[guardado]}
        </Pildora>
      </div>
      {guardado === "cobro" ? (
        <div className="flex flex-col gap-2 rounded-[14px] bg-tarjeta-hover p-3">
          <p className="text-[13px] text-texto-2">Lo cobrado entró a Por asignar. Dale un trabajo:</p>
          <EnlaceBoton href="/sobres/repartir" variante="secundario">
            Repartir
          </EnlaceBoton>
        </div>
      ) : null}
    </AvisoPasajero>
  );
}

type Datos = {
  /** Pagar lo que debo o cobrar lo que me deben: mismos campos, otra acción. */
  cual: "pago" | "cobro";
  inicial: ValoresPago;
  /** Las cuentas activas en dólares. */
  cuentas: { id: number; nombre: string; moneda: string }[];
  hoy: string;
  /** El saldo de Deudas ahora, para "Deudas tiene X; quedará en Y". Solo al pagar. */
  saldoDeudasCentavos: number | null;
  /** Lo que se acaba de guardar, si se llega desde el guardado. */
  guardado?: Guardado;
};

/**
 * Registrar un pago o un cobro (spec 005, criterios 3 y 5): el monto viene con lo pendiente escrito y la cuenta, con
 * la prevista o la primera en dólares. Al pagar, debajo, lo que tiene Deudas y en cuánto quedará, en rojo si queda
 * bajo cero: se guarda igual y la cuota del siguiente reparto lo repone. Sin JavaScript la línea se calcula con el
 * monto que trae el formulario. Al cobrar, el dinero entra a "Por asignar".
 *
 * El aviso de lo guardado va arriba, mientras no se toque nada: se va al editar o si vuelve un error, porque lo que se
 * ve ya no es lo guardado (revisión de la 005). Cada pantalla servida trae otro `idCaptura`, así que tras guardar otra
 * vez los campos se montan de nuevo, con el pendiente nuevo y el aviso.
 */
export function FormularioPago({ inicial, guardado, ...datos }: Datos) {
  const accion = datos.cual === "pago" ? pagarConFallas : cobrarConFallas;
  const [estado, enviar, pendiente] = useActionState<EstadoPago, FormData>(accion, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={`${estado.ronda}-${inicial.idCaptura}`}
      {...datos}
      guardado={estado.estado === "inicial" ? guardado : undefined}
      valores={estado.estado === "error" ? estado.valores : inicial}
      errores={estado.estado === "error" ? estado.errores : {}}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  cual,
  valores,
  errores,
  cuentas,
  hoy,
  saldoDeudasCentavos,
  guardado,
  enviar,
  pendiente,
}: Omit<Datos, "inicial"> & {
  valores: ValoresPago;
  errores: ErroresFormularioPago;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  const [monto, setMonto] = useState(valores.monto);
  const [cuentaId, setCuentaId] = useState(valores.cuentaId);
  const [fecha, setFecha] = useState(valores.fecha);
  const [editado, setEditado] = useState(false);
  const moneda = cuentas.find((c) => String(c.id) === cuentaId)?.moneda ?? "USD";
  const centavos = montoPositivo(monto);
  const aviso =
    centavos === null || saldoDeudasCentavos === null ? null : avisoDelSobreDeudas(saldoDeudasCentavos, centavos);

  return (
    <form action={enviar} onChange={() => setEditado(true)} className="flex flex-col gap-4">
      {guardado && !editado ? <AvisoGuardado guardado={guardado} /> : null}
      <input type="hidden" name="deudaId" value={valores.deudaId} />
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />

      <Campo etiqueta={cual === "pago" ? "Monto del pago" : "Monto del cobro"} error={errores.monto}>
        <CampoMonto name="monto" value={monto} onChange={(e) => setMonto(e.target.value)} unidad={unidadDe(moneda)} />
      </Campo>
      {aviso ? (
        <p
          aria-live="polite"
          className={`-mt-2 text-[13px] font-semibold ${aviso.negativo ? "text-negativo" : "text-texto-3"}`}
        >
          {aviso.texto}
        </p>
      ) : null}

      <SelectorPildoras
        etiqueta="Cuenta"
        name="cuentaId"
        opciones={cuentas.map((c) => ({ valor: String(c.id), texto: c.nombre, detalle: c.moneda }))}
        valorInicial={valores.cuentaId}
        onCambio={setCuentaId}
        envolver
        error={errores.cuenta}
      />

      {/* El calendario elige con botones, que no disparan el onChange del formulario. */}
      <SelectorFecha
        name="fecha"
        valor={fecha}
        hoy={hoy}
        onCambio={(f) => {
          setFecha(f);
          setEditado(true);
        }}
        error={errores.fecha}
      />

      <Campo etiqueta="Nota" ayuda="Opcional">
        <Entrada name="nota" defaultValue={valores.nota} maxLength={200} autoComplete="off" />
      </Campo>

      <ErrorCampo>{errores.general ?? errores.deuda}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="w-full">
        {cual === "pago" ? "Registrar pago" : "Registrar cobro"}
      </Boton>
    </form>
  );
}
