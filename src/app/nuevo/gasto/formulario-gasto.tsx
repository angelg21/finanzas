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
import { direccionConBorrador } from "@/lib/borrador-captura";
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
  La cuenta del pago en dólares y la de la venta son grupos distintos: cada una con su valor por defecto.
*/
const soloEnDolares = "hidden group-has-[[name=forma][value=dolares]:checked]/gasto:block";
const soloAlVender = "hidden group-has-[[name=forma][value=vendiendo]:checked]/gasto:block";
const soloEnBolivares = "group-has-[[name=forma][value=dolares]:checked]/gasto:hidden";
const soloDelSaldo = "hidden group-has-[[name=forma][value=saldo]:checked]/gasto:block";

/** Lo que llega en la dirección: de "Registrar otro" o, con lo escrito, de crear una categoría con "Nueva". */
type Inicial = { forma: FormaPago; cuentaId: string; cuentaVentaId: string; categoriaId?: string } & Partial<
  Record<"monto" | "tasa" | "vendido" | "sobreId" | "fecha" | "nota", string>
>;

/** Captura de gasto. "Registrar otro" la vuelve a montar con la misma forma de pago y las mismas cuentas. */
export function FormularioGasto({ inicial, ...datos }: Datos & { inicial: Inicial }) {
  const [captura, setCaptura] = useState({ numero: 0, ...inicial });
  return (
    <Captura
      key={captura.numero}
      {...datos}
      inicial={captura}
      alRegistrarOtro={(forma, cuentaId, cuentaVentaId) =>
        setCaptura((c) => ({ numero: c.numero + 1, forma, cuentaId, cuentaVentaId }))
      }
    />
  );
}

function Captura({
  inicial,
  alRegistrarOtro,
  ...datos
}: Datos & {
  inicial: Inicial;
  alRegistrarOtro: (forma: FormaPago, cuentaId: string, cuentaVentaId: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoGasto, FormData>(registrarGasto, {
    ronda: 0,
    estado: "inicial",
  });
  /*
    El sobre sugerido sigue a la categoría hasta que se elige un sobre a mano (criterio 8). Vive aquí y no
    en Campos, que se monta de nuevo tras cada respuesta: un error o el aviso de Inversión no lo olvidan.
  */
  const [sobreTocado, setSobreTocado] = useState(inicial.sobreId !== undefined);

  if (estado.estado === "guardado") {
    return (
      <ResumenGasto
        resumen={estado.resumen}
        forma={estado.forma}
        cuentaId={estado.cuentaId}
        cuentaVentaId={estado.cuentaVentaId}
        alRegistrarOtro={() => alRegistrarOtro(estado.forma, estado.cuentaId, estado.cuentaVentaId)}
      />
    );
  }

  const valores: ValoresGasto =
    estado.estado === "inicial"
      ? {
          forma: inicial.forma,
          monto: inicial.monto ?? "",
          tasa: inicial.tasa ?? "",
          vendido: inicial.vendido ?? "",
          cuentaId: inicial.cuentaId,
          cuentaVentaId: inicial.cuentaVentaId,
          // ?categoria= llega al volver de crear una con la píldora "Nueva" (criterio 25).
          categoriaId: inicial.categoriaId ?? "",
          sobreId:
            inicial.sobreId ??
            String(
              sobreSugerido(
                datos.categorias.find((c) => String(c.id) === inicial.categoriaId)?.nombre ?? "",
                datos.sobres,
              ) ?? "",
            ),
          // "Hoy" como atajo, no como la fecha de hoy: se resuelve al guardar (criterio 11).
          fecha: inicial.fecha ?? "hoy",
          nota: inicial.nota ?? "",
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
      sobreTocado={sobreTocado}
      alTocarSobre={() => setSobreTocado(true)}
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
  sobreTocado,
  alTocarSobre,
  enviar,
  pendiente,
}: Datos & {
  valores: ValoresGasto;
  errores: ErroresFormularioGasto;
  confirmar: boolean;
  primeraVez: boolean;
  sobreTocado: boolean;
  alTocarSobre: () => void;
  enviar: (formData: FormData) => void;
  pendiente: boolean;
}) {
  const [forma, setForma] = useState<FormaPago>(valores.forma);
  const [cuentaId, setCuentaId] = useState(valores.cuentaId);
  const [cuentaVentaId, setCuentaVentaId] = useState(valores.cuentaVentaId);
  const [sobreId, setSobreId] = useState(valores.sobreId);
  const [fecha, setFecha] = useState(valores.fecha);
  // Lo tecleado, para el "Antes y después" de escritorio. Los campos siguen siendo no controlados.
  const [monto, setMonto] = useState(valores.monto);
  const [tasa, setTasa] = useState(valores.tasa);
  const [vendido, setVendido] = useState(valores.vendido);
  const [nota, setNota] = useState(valores.nota);

  const enDolares = cuentas.filter((c) => c.moneda !== "VES");
  const opcionesCuenta = enDolares.map((c) => ({
    valor: String(c.id),
    texto: c.nombre,
    detalle: c.esPropia ? undefined : "a nombre de mi prima",
  }));
  const monedaDe = (id: string) => enDolares.find((c) => String(c.id) === id)?.moneda ?? "USD";
  const inversion = sobres.find((s) => s.tipo === "inversion");
  const confirmando = confirmar && inversion !== undefined && sobreId === String(inversion.id);
  const origen = forma === "vendiendo" ? cuentaVentaId : cuentaId;
  const afectados = saldosAfectados({ forma, monto, tasa, vendido, cuentaId: origen, sobreId, cuentas, sobres, hoy });

  return (
    <>
      <Tarjeta className="lg:col-span-7">
        <form action={enviar} className="group/gasto flex flex-col gap-5">
          <Campo etiqueta="Monto" error={errores.monto}>
            <CampoMonto
              name="monto"
              // Bs o dólares según la forma de pago, también sin JavaScript; cuál moneda de dólares, con él.
              unidad={
                <>
                  <span className={soloEnDolares}>{unidadDe(monedaDe(cuentaId))}</span>
                  <span className={soloEnBolivares}>{unidadDe("VES")}</span>
                </>
              }
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
              etiqueta="Cuenta"
              name="cuentaId"
              envolver
              opciones={opcionesCuenta}
              valorInicial={valores.cuentaId}
              onCambio={setCuentaId}
              error={errores.cuenta}
            />
          </div>
          <div className={soloAlVender}>
            <SelectorPildoras
              etiqueta="Salen de"
              name="cuentaVentaId"
              envolver
              opciones={opcionesCuenta}
              valorInicial={valores.cuentaVentaId}
              onCambio={setCuentaVentaId}
              error={errores.cuenta}
            />
          </div>

          <div className={`grid grid-cols-2 gap-3 ${soloEnBolivares}`}>
            <div className={soloAlVender}>
              <Campo etiqueta={`${unidadDe(monedaDe(cuentaVentaId))} vendidos`} error={errores.vendido}>
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
          {/* Del saldo no se ve ningún grupo de cuentas: si falta la cuenta en bolívares, el error va aquí. */}
          {errores.cuenta ? (
            <p role="alert" className={`${soloDelSaldo} text-[13px] font-semibold text-negativo`}>
              {errores.cuenta}
            </p>
          ) : null}

          <SelectorPildoras
            etiqueta="Categoría"
            name="categoriaId"
            // Envueltas también en el celular, como cuenta y sobre: desplazarse de lado es incómodo.
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
                // Lo escrito viaja en la dirección y vuelve con la categoría nueva elegida (criterio 25).
                // Sin precarga: la dirección cambia con cada tecla y la captura no debe pagar por ello.
                prefetch={false}
                href={`/categorias/nueva?volver=${encodeURIComponent(
                  direccionConBorrador("/nuevo/gasto", {
                    forma,
                    monto,
                    tasa,
                    vendido,
                    cuenta: cuentaId,
                    venta: cuentaVentaId,
                    sobre: sobreTocado ? sobreId : "",
                    fecha,
                    nota,
                  }),
                )}`}
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
            envolver
            opciones={sobres.map((s) => ({
              valor: String(s.id),
              texto: s.nombre,
              detalle: s.tipo === "inversion" ? "intocable" : undefined,
            }))}
            valor={sobreId}
            onCambio={setSobreId}
            // Tocar el sobre ya marcado también cuenta: es elegirlo a mano (criterio 8).
            alTocar={alTocarSobre}
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
              onChange={(e) => setNota(e.target.value)}
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
