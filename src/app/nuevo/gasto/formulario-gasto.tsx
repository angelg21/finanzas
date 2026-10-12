"use client";

import { CircleAlert, Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { SelectorFecha } from "@/components/calendario";
import {
  Boton,
  Campo,
  CampoMonto,
  Entrada,
  SelectorPildoras,
  pildoraNormal,
  pildoraOpcion,
} from "@/components/formulario";
import { Tarjeta } from "@/components/ui";
import { type Moneda, unidadDe } from "@/lib/dinero";
import { type FormaPago, sobreSugerido } from "@/lib/gastos";
import { type ErroresFormularioGasto, type EstadoGasto, type ValoresGasto, registrarGasto } from "./acciones";
import { AntesYDespues, saldosAfectados } from "./antes-y-despues";
import { ResumenGasto } from "./resumen-gasto";

export type CuentaGasto = { id: number; nombre: string; moneda: Moneda; esPropia: boolean; saldoCentavos: number };
export type SobreGasto = {
  id: number;
  nombre: string;
  tipo: string;
  saldoCentavos: number;
  topeCentavos: number | null;
};
type Datos = {
  categorias: { id: number; nombre: string; icono: string; color: string }[];
  sobres: SobreGasto[];
  cuentas: CuentaGasto[];
  hoy: string;
};

const formasPago = [
  { valor: "dolares", texto: "Dólares" },
  { valor: "vendiendo", texto: "Bolívares vendiendo USDT" },
  { valor: "saldo", texto: "Bolívares del saldo" },
];

/*
  Qué campos se ven según la forma de pago. Se decide en CSS con :has() sobre el radio marcado, así
  funciona sin JavaScript y no parpadea al cargar. Los campos ocultos se envían igual; la acción los ignora.
*/
const soloEnDolares = "group-has-[[name=forma][value=saldo]:checked]/gasto:hidden";
const soloAlVender = "hidden group-has-[[name=forma][value=vendiendo]:checked]/gasto:block";
const soloEnBolivares = "group-has-[[name=forma][value=dolares]:checked]/gasto:hidden";

type Inicial = { forma: FormaPago; cuentaId: string; categoriaId?: string };

/** Captura de gasto. "Registrar otro" la vuelve a montar con la misma forma de pago y la misma cuenta. */
export function FormularioGasto({ inicial, ...datos }: Datos & { inicial: Inicial }) {
  const [captura, setCaptura] = useState({ numero: 0, ...inicial });
  return (
    <Captura
      key={captura.numero}
      {...datos}
      inicial={captura}
      alRegistrarOtro={(forma, cuentaId) => setCaptura((c) => ({ numero: c.numero + 1, forma, cuentaId }))}
    />
  );
}

function Captura({
  inicial,
  alRegistrarOtro,
  ...datos
}: Datos & {
  inicial: Inicial;
  alRegistrarOtro: (forma: FormaPago, cuentaId: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoGasto, FormData>(registrarGasto, {
    ronda: 0,
    estado: "inicial",
  });

  if (estado.estado === "guardado") {
    return (
      <ResumenGasto
        resumen={estado.resumen}
        forma={estado.forma}
        cuentaId={estado.cuentaId}
        alRegistrarOtro={() => alRegistrarOtro(estado.forma, estado.cuentaId)}
      />
    );
  }

  const valores: ValoresGasto =
    estado.estado === "inicial"
      ? {
          forma: inicial.forma,
          monto: "",
          tasa: "",
          vendido: "",
          cuentaId: inicial.cuentaId,
          // ?categoria= llega al volver de crear una con la píldora "Nueva" (criterio 25).
          categoriaId: inicial.categoriaId ?? "",
          sobreId: String(
            sobreSugerido(
              datos.categorias.find((c) => String(c.id) === inicial.categoriaId)?.nombre ?? "",
              datos.sobres,
            ) ?? "",
          ),
          fecha: datos.hoy,
          nota: "",
        }
      : estado.valores;

  return (
    // Con la ronda como key los campos se montan de nuevo con lo tecleado tras cada respuesta.
    <Campos
      key={estado.ronda}
      {...datos}
      valores={valores}
      errores={estado.estado === "error" ? estado.errores : {}}
      confirmar={estado.estado === "confirmar"}
      primeraVez={estado.ronda === 0}
      enviar={enviar}
      pendiente={pendiente}
    />
  );
}

function Campos({
  categorias,
  sobres,
  cuentas,
  hoy,
  valores,
  errores,
  confirmar,
  primeraVez,
  enviar,
  pendiente,
}: Datos & {
  valores: ValoresGasto;
  errores: ErroresFormularioGasto;
  confirmar: boolean;
  primeraVez: boolean;
  enviar: (formData: FormData) => void;
  pendiente: boolean;
}) {
  const [forma, setForma] = useState<FormaPago>(valores.forma);
  const [cuentaId, setCuentaId] = useState(valores.cuentaId);
  const [sobreId, setSobreId] = useState(valores.sobreId);
  // El sobre sugerido sigue a la categoría hasta que se elige un sobre a mano (criterio 8).
  const [sobreTocado, setSobreTocado] = useState(false);
  const [fecha, setFecha] = useState(valores.fecha);
  // Lo tecleado, para el "Antes y después" de escritorio. Los campos siguen siendo no controlados.
  const [monto, setMonto] = useState(valores.monto);
  const [tasa, setTasa] = useState(valores.tasa);
  const [vendido, setVendido] = useState(valores.vendido);

  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const monedaCuenta = enDolares.find((c) => String(c.id) === cuentaId)?.moneda ?? "USD";
  const inversion = sobres.find((s) => s.tipo === "inversion");
  const confirmando = confirmar && inversion !== undefined && sobreId === String(inversion.id);
  const afectados = saldosAfectados({ forma, monto, tasa, vendido, cuentaId, sobreId, cuentas, sobres, hoy });

  return (
    <>
      <Tarjeta className="lg:col-span-7">
        <form action={enviar} className="group/gasto flex flex-col gap-5">
          <Campo etiqueta="Monto" error={errores.monto}>
            <CampoMonto
              name="monto"
              moneda={forma === "dolares" ? monedaCuenta : "VES"}
              defaultValue={valores.monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus={primeraVez || errores.monto !== undefined}
              aria-invalid={errores.monto ? true : undefined}
            />
          </Campo>

          <SelectorPildoras
            etiqueta="Forma de pago"
            name="forma"
            opciones={formasPago}
            valorInicial={valores.forma}
            onCambio={(v) => setForma(v as FormaPago)}
            envolver
          />

          <div className={soloEnDolares}>
            <SelectorPildoras
              etiqueta={forma === "vendiendo" ? "Salen de" : "Cuenta"}
              name="cuentaId"
              opciones={enDolares.map((c) => ({
                valor: String(c.id),
                texto: c.nombre,
                detalle: c.esPropia ? undefined : "a nombre de mi prima",
              }))}
              valorInicial={valores.cuentaId}
              onCambio={setCuentaId}
              error={errores.cuenta}
            />
          </div>

          <div className={`grid grid-cols-2 gap-3 ${soloEnBolivares}`}>
            <div className={soloAlVender}>
              <Campo etiqueta={`${unidadDe(monedaCuenta)} vendidos`} error={errores.vendido}>
                <Entrada
                  name="vendido"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="20"
                  defaultValue={valores.vendido}
                  onChange={(e) => setVendido(e.target.value)}
                />
              </Campo>
            </div>
            <Campo etiqueta="Tasa Bs/USD" error={errores.tasa}>
              <Entrada
                name="tasa"
                inputMode="decimal"
                autoComplete="off"
                placeholder="241,8"
                defaultValue={valores.tasa}
                onChange={(e) => setTasa(e.target.value)}
              />
            </Campo>
          </div>

          <SelectorPildoras
            etiqueta="Categoría"
            name="categoriaId"
            // Envueltas también en el celular: con muchas categorías, desplazarse de lado es incómodo.
            envolver
            opciones={categorias.map((c) => ({
              valor: String(c.id),
              texto: c.nombre,
              categoria: { icono: c.icono, color: c.color },
            }))}
            valorInicial={valores.categoriaId}
            onCambio={(v) => {
              const nombre = categorias.find((c) => String(c.id) === v)?.nombre ?? "";
              const sugerido = sobreSugerido(nombre, sobres);
              if (!sobreTocado && sugerido !== null) setSobreId(String(sugerido));
            }}
            error={errores.categoria}
            extra={
              <Link
                href="/categorias/nueva?volver=/nuevo/gasto"
                className={`${pildoraOpcion} ${pildoraNormal} shrink-0 border-dashed`}
              >
                <Plus size={16} aria-hidden />
                Nueva
              </Link>
            }
          />

          <SelectorPildoras
            etiqueta="Sobre"
            name="sobreId"
            opciones={sobres.map((s) => ({
              valor: String(s.id),
              texto: s.nombre,
              detalle: s.tipo === "inversion" ? "intocable" : undefined,
            }))}
            valor={sobreId}
            onCambio={(v) => {
              setSobreId(v);
              setSobreTocado(true);
            }}
            error={errores.sobre}
          />

          <SelectorFecha name="fecha" valor={fecha} hoy={hoy} onCambio={setFecha} error={errores.fecha} />

          <Campo etiqueta="Nota">
            <Entrada
              name="nota"
              placeholder="Opcional"
              maxLength={200}
              autoComplete="off"
              defaultValue={valores.nota}
            />
          </Campo>

          {confirmando ? (
            <p role="alert" className="flex items-start gap-2 text-[13px] font-semibold text-negativo">
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              Inversión es intocable. ¿Gastar igual?
              <input type="hidden" name="confirmarSobre" value={inversion.id} />
            </p>
          ) : null}
          {errores.general ? (
            <p role="alert" className="text-[13px] font-semibold text-negativo">
              {errores.general}
            </p>
          ) : null}

          <Boton type="submit" disabled={pendiente} autoFocus={confirmando} className="w-full">
            {pendiente ? "Guardando…" : confirmando ? "Sí, gastar de Inversión" : "Guardar gasto"}
          </Boton>
        </form>
      </Tarjeta>
      <AntesYDespues {...afectados} />
    </>
  );
}
