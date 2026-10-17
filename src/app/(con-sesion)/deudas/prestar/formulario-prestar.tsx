"use client";

import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import { Boton, Campo, CampoMonto, Entrada, ErrorCampo, SelectorPildoras } from "@/components/formulario";
import { avisoDelSobre } from "@/lib/deudas";
import { formatearCifra, montoPositivo, unidadDe } from "@/lib/dinero";
import { prestarConFallas } from "./prestar-con-fallas";
import type { ErroresFormularioPrestamo, EstadoPrestamo, ValoresPrestamo } from "./valores";

type Datos = {
  inicial: ValoresPrestamo;
  /** Las cuentas activas en dólares. */
  cuentas: { id: number; nombre: string; moneda: string }[];
  /** Los sobres de los que puede salir: nunca Deudas ni Inversión. */
  sobres: { id: number; nombre: string; saldoCentavos: number }[];
  hoy: string;
};

/**
 * Prestar dinero a otro (spec 005, criterio 4): a quién, cuánto, de qué cuenta y de qué sobre, cuándo se prestó y
 * cuándo se espera cobrarlo. La unidad del monto sigue a la cuenta elegida. Con sobre y monto, debajo del sobre, lo
 * que tiene y en cuánto quedará, en rojo si queda bajo cero: se guarda igual, como un gasto (observación 11, decidido
 * el 2026-10-16). Sin JavaScript la línea no sale, porque el monto llega vacío.
 */
export function FormularioPrestar({ inicial, ...datos }: Datos) {
  const [estado, enviar, pendiente] = useActionState<EstadoPrestamo, FormData>(prestarConFallas, {
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
  sobres,
  hoy,
  enviar,
  pendiente,
}: Omit<Datos, "inicial"> & {
  valores: ValoresPrestamo;
  errores: ErroresFormularioPrestamo;
  enviar: (datos: FormData) => void;
  pendiente: boolean;
}) {
  const [monto, setMonto] = useState(valores.monto);
  const [cuentaId, setCuentaId] = useState(valores.cuentaId);
  const [sobreId, setSobreId] = useState(valores.sobreOrigenId);
  const [fecha, setFecha] = useState(valores.fecha);
  const [fechaPrevista, setFechaPrevista] = useState(valores.fechaPrevista);
  const moneda = cuentas.find((c) => String(c.id) === cuentaId)?.moneda ?? "USD";
  const sobre = sobres.find((s) => String(s.id) === sobreId);
  const centavos = montoPositivo(monto);
  const aviso = sobre && centavos !== null ? avisoDelSobre(sobre.nombre, sobre.saldoCentavos, centavos) : null;

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="idCaptura" value={valores.idCaptura} />

      <Campo etiqueta="A quién" error={errores.persona}>
        <Entrada name="persona" defaultValue={valores.persona} maxLength={80} autoComplete="off" />
      </Campo>

      <Campo etiqueta="Cuánto" error={errores.monto}>
        <CampoMonto name="monto" value={monto} onChange={(e) => setMonto(e.target.value)} unidad={unidadDe(moneda)} />
      </Campo>

      <SelectorPildoras
        etiqueta="Cuenta"
        name="cuentaId"
        opciones={cuentas.map((c) => ({ valor: String(c.id), texto: c.nombre, detalle: c.moneda }))}
        valorInicial={valores.cuentaId}
        onCambio={setCuentaId}
        envolver
        error={errores.cuenta}
      />

      <SelectorPildoras
        etiqueta="De qué sobre sale"
        name="sobreOrigenId"
        opciones={sobres.map((s) => ({
          valor: String(s.id),
          texto: s.nombre,
          detalle: formatearCifra(s.saldoCentavos),
        }))}
        valorInicial={valores.sobreOrigenId}
        onCambio={setSobreId}
        envolver
        error={errores.sobre}
      />
      {aviso ? (
        <p
          aria-live="polite"
          className={`-mt-2 text-[13px] font-semibold ${aviso.negativo ? "text-negativo" : "text-texto-3"}`}
        >
          {aviso.texto}
        </p>
      ) : null}

      <SelectorFecha name="fecha" valor={fecha} hoy={hoy} onCambio={setFecha} error={errores.fecha} />

      <SelectorFecha
        name="fechaPrevista"
        variante="futura"
        etiqueta="Cuándo esperas cobrarlo"
        valor={fechaPrevista}
        hoy={hoy}
        onCambio={setFechaPrevista}
        error={errores.fechaPrevista}
      />

      <Campo etiqueta="Nota" ayuda="Opcional">
        <Entrada name="nota" defaultValue={valores.nota} maxLength={200} autoComplete="off" />
      </Campo>

      <ErrorCampo>{errores.general}</ErrorCampo>
      <Boton type="submit" disabled={pendiente} className="w-full">
        Prestar
      </Boton>
    </form>
  );
}
