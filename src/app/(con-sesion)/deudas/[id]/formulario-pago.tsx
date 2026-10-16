"use client";

import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import { Boton, Campo, CampoMonto, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { avisoDelSobreDeudas } from "@/lib/deudas";
import { aCentavos, unidadDe } from "@/lib/dinero";
import { pagarConFallas } from "./pagar-con-fallas";
import type { ErroresFormularioPago, EstadoPago, ValoresPago } from "./valores";

type Datos = {
  inicial: ValoresPago;
  /** Las cuentas activas en dólares. */
  cuentas: { id: number; nombre: string; moneda: string }[];
  hoy: string;
  /** El saldo de Deudas ahora, para "Deudas tiene X; quedará en Y". */
  saldoDeudasCentavos: number;
};

/** El monto escrito en centavos, o null mientras no se lee como un monto mayor que cero. */
function leido(texto: string): number | null {
  try {
    const centavos = aCentavos(texto);
    return centavos > 0 ? centavos : null;
  } catch {
    return null;
  }
}

/**
 * Registrar un pago (spec 005, criterio 3): el monto viene con lo pendiente escrito y la cuenta, con la prevista o la
 * primera en dólares. Debajo, lo que tiene Deudas y en cuánto quedará, en rojo si queda bajo cero: se guarda igual y
 * la cuota del siguiente reparto lo repone. Sin JavaScript la línea se calcula con el monto que trae el formulario.
 */
export function FormularioPago({ inicial, ...datos }: Datos) {
  const [estado, enviar, pendiente] = useActionState<EstadoPago, FormData>(pagarConFallas, {
    ronda: 0,
    estado: "inicial",
  });
  return (
    <Campos
      key={estado.ronda}
      {...datos}
      valores={estado.estado === "error" ? estado.valores : inicial}
      errores={estado.estado === "error" ? estado.errores : {}}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  valores,
  errores,
  cuentas,
  hoy,
  saldoDeudasCentavos,
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
  const moneda = cuentas.find((c) => String(c.id) === cuentaId)?.moneda ?? "USD";
  const centavos = leido(monto);
  const aviso = centavos === null ? null : avisoDelSobreDeudas(saldoDeudasCentavos, centavos);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="deudaId" value={valores.deudaId} />
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />

      <Campo etiqueta="Monto del pago" error={errores.monto}>
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

      <SelectorFecha name="fecha" valor={fecha} hoy={hoy} onCambio={setFecha} error={errores.fecha} />

      <Campo etiqueta="Nota" ayuda="Opcional">
        <Entrada name="nota" defaultValue={valores.nota} maxLength={200} autoComplete="off" />
      </Campo>

      <ErrorCampo>{errores.general ?? errores.deuda}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="w-full">
        Registrar pago
      </Boton>
    </form>
  );
}
