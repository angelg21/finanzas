"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaGasto } from "@/db/consultas";
import { registrarCaptura } from "@/db/movimientos";
import type { Moneda } from "@/lib/dinero";
import { fechaDesdeAtajo, hoyEnCaracas } from "@/lib/fechas";
import { esIdCaptura, referenciaDeCaptura, resolverReintento } from "@/lib/captura";
import { mensajeDeFalla } from "@/lib/fallas";
import { type ErroresGasto, type FormaPago, prepararGasto, saldosTras } from "@/lib/gastos";
import { leerSesion } from "@/app/sesion";

/** Lo que se tecleó, para volver a llenar el formulario si hay que corregir o confirmar. */
export type ValoresGasto = {
  forma: FormaPago;
  monto: string;
  tasa: string;
  vendido: string;
  /** Cuenta del pago en dólares. */
  cuentaId: string;
  /** Cuenta de donde salen los dólares vendidos; su propio grupo, para que empiece en Binance. */
  cuentaVentaId: string;
  categoriaId: string;
  sobreId: string;
  fecha: string;
  nota: string;
  /** El UUID de esta captura (src/lib/captura.ts): el mismo en cada reintento, para no duplicar el gasto. */
  idCaptura: string;
};

export type ErroresFormularioGasto = ErroresGasto & { categoria?: string; sobre?: string; general?: string };

/** Datos del resumen tras guardar (criterio 13) y de los avisos de sobre negativo y vuelto (10 y 4). */
export type ResumenGasto = {
  montoCentavos: number;
  moneda: Moneda;
  montoUsdCentavos: number;
  categoria: string;
  cuenta: string;
  sobre: string;
  sobreDespuesCentavos: number;
  /** Saldo en Bs de la cuenta Bolívares tras el gasto; null si se pagó en dólares. */
  bolivaresDespuesCentavos: number | null;
  /**
   * Lo vendido, de qué cuenta salió y el vuelto de esta venta en Bs (lo recibido menos lo gastado), para la
   * confirmación; null si no hubo venta. El vuelto no es el saldo de Bolívares, que puede traer bolívares de antes.
   */
  venta: { montoCentavos: number; moneda: Moneda; cuenta: string; vueltoCentavos: number } | null;
};

type Resultado =
  | { estado: "error"; errores: ErroresFormularioGasto; valores: ValoresGasto }
  /** Sobre Inversión: hace falta un segundo clic (criterio 9). */
  | { estado: "confirmar"; valores: ValoresGasto }
  /** "Registrar otro" reabre con la misma forma de pago y las mismas cuentas, y una captura nueva. */
  | {
      estado: "guardado";
      resumen: ResumenGasto;
      forma: FormaPago;
      cuentaId: string;
      cuentaVentaId: string;
      siguienteCaptura: string;
    };

/**
 * `ronda` cuenta las respuestas. React reinicia el formulario al terminar cada acción; con la ronda como
 * `key` los campos se vuelven a montar con lo tecleado, también sin JavaScript.
 */
export type EstadoGasto = { ronda: number } & ({ estado: "inicial" } | Resultado);

const cifra = z.string().trim().max(30, "Ese número es demasiado largo");
const formas = z.enum(["dolares", "vendiendo", "saldo"], { error: "Elige una forma de pago" });

const esquema = z.object({
  forma: formas,
  monto: cifra,
  tasa: cifra,
  vendido: cifra,
  cuentaId: z.string(),
  cuentaVentaId: z.string(),
  categoriaId: z.string(),
  sobreId: z.string(),
  fecha: z.string().trim(),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
  // Sin un id de captura válido, la página es de antes de esta versión.
  idCaptura: z.string().refine(esIdCaptura, mensajeDeFalla("version")),
});

const campos = [
  "forma",
  "monto",
  "tasa",
  "vendido",
  "cuentaId",
  "cuentaVentaId",
  "categoriaId",
  "sobreId",
  "fecha",
  "nota",
  "idCaptura",
] as const satisfies readonly (keyof ValoresGasto)[];

/** Un campo como texto; si falta, vacío. */
function campo(formData: FormData, nombre: keyof ValoresGasto | "confirmarSobre") {
  const valor = formData.get(nombre);
  return typeof valor === "string" ? valor : "";
}

/** Lo tecleado, campo por campo; una forma de pago desconocida vuelve como "dolares". */
function tecleadoDe(formData: FormData): ValoresGasto {
  const tecleado = Object.fromEntries(campos.map((nombre) => [nombre, campo(formData, nombre)]));
  return { ...tecleado, forma: formas.safeParse(tecleado.forma).data ?? "dolares" } as ValoresGasto;
}

/**
 * Registra un gasto (spec 001). Para `useActionState`. Con la sesión vencida no redirige: responde con el mensaje y
 * lo tecleado, para que la pantalla no se pierda (spec 002, criterio 19).
 */
export async function registrarGasto(previo: EstadoGasto, formData: FormData): Promise<EstadoGasto> {
  const sesion = await leerSesion();
  if (!sesion) {
    const general = mensajeDeFalla("sesion");
    return { ronda: (previo?.ronda ?? 0) + 1, estado: "error", errores: { general }, valores: tecleadoDe(formData) };
  }
  return { ronda: (previo?.ronda ?? 0) + 1, ...(await procesarGasto(formData)) };
}

/**
 * Nada del formulario se cree a ciegas: el sobre, la categoría y las cuentas se buscan en la base entre
 * los activos y aptos, y la moneda sale de la cuenta, no del formulario. El check de la base solo valida
 * la forma de la fila, no que el sobre sea "Por asignar" o la categoría de ingreso.
 */
async function procesarGasto(formData: FormData): Promise<Resultado> {
  const tecleado = Object.fromEntries(campos.map((nombre) => [nombre, campo(formData, nombre)]));
  /** Id del sobre Inversión cuando ya se confirmó el aviso. */
  const confirmarSobre = campo(formData, "confirmarSobre");
  const leido = esquema.safeParse(tecleado);
  if (!leido.success) {
    // Se devuelve lo tecleado para no vaciar el formulario.
    return {
      estado: "error",
      errores: { general: leido.error.issues[0]?.message ?? "Revisa los datos del formulario" },
      valores: tecleadoDe(formData),
    };
  }
  const valores = leido.data;

  const [categorias, sobres, cuentas] = await Promise.all([
    categoriasDeGastoPorUso(),
    sobresParaGasto(),
    saldosPorCuenta(),
  ]);
  const categoria = categorias.find((c) => String(c.id) === valores.categoriaId);
  const sobre = sobres.find((s) => String(s.id) === valores.sobreId);
  const elegida = valores.forma === "vendiendo" ? valores.cuentaVentaId : valores.cuentaId;
  const cuentaOrigen = cuentas.find((c) => String(c.id) === elegida && c.moneda !== "VES");
  const bolivares = cuentas.find((c) => c.moneda === "VES") ?? null;

  // "Hoy" es el de ahora, al guardar, no el del día en que se abrió la pantalla (criterio 11).
  const hoy = hoyEnCaracas(new Date());
  const preparado = prepararGasto(
    {
      ...valores,
      fecha: fechaDesdeAtajo(valores.fecha, hoy),
      // Sin cuenta válida, una en bolívares hace que prepararGasto pida "Elige una cuenta en dólares".
      cuentaOrigen: cuentaOrigen ?? { id: 0, moneda: "VES" },
      cuentaBolivares: bolivares,
      sobreId: sobre?.id ?? 0,
      categoriaId: categoria?.id ?? 0,
    },
    hoy,
  );

  const errores: ErroresFormularioGasto = preparado.ok ? {} : { ...preparado.errores };
  if (!categoria) errores.categoria = "Elige una categoría";
  if (!sobre) errores.sobre = "Elige un sobre";
  if (!preparado.ok || !categoria || !sobre) return { estado: "error", errores, valores };

  if (sobre.tipo === "inversion" && confirmarSobre !== String(sobre.id)) return { estado: "confirmar", valores };

  // Cada fila con la referencia de esta captura: un reintento choca con el índice único y no duplica.
  const filas = preparado.filas.map((f) => ({
    ...f,
    referenciaExterna: referenciaDeCaptura(valores.idCaptura, f.tipo),
  }));
  let registro: Awaited<ReturnType<typeof registrarCaptura>>;
  try {
    registro = await registrarCaptura(valores.idCaptura, filas);
  } catch (error) {
    console.error("No se pudo registrar el gasto", error);
    return { estado: "error", errores: { general: "No se pudo guardar. Intenta de nuevo." }, valores };
  }

  let saldosCuentas = cuentas;
  let saldoSobre = sobre.saldoCentavos;
  if (!registro.nueva) {
    // Ya había algo con este id. Solo es "ya estaba" si es lo mismo y reciente; si no, se avisa y el id cambia.
    if (resolverReintento(registro.guardadas, filas, new Date()) === "otra") {
      return {
        estado: "error",
        errores: {
          general: "Esta captura ya se guardó antes: revísala en Movimientos y, si es otro gasto, vuelve a guardar.",
        },
        valores: { ...valores, idCaptura: crypto.randomUUID() },
      };
    }
    // El choque solo se resuelve cuando el primer intento ya confirmó: releer trae los saldos con el gasto incluido.
    const [cuentasAhora, sobresAhora] = await Promise.all([saldosPorCuenta(), sobresParaGasto()]);
    saldosCuentas = cuentasAhora;
    saldoSobre = sobresAhora.find((s) => s.id === sobre.id)?.saldoCentavos ?? sobre.saldoCentavos;
  }

  // Los saldos tras el gasto se calculan con los que ya se leyeron: sin otra consulta en la captura. Si ya
  // estaba, los releídos ya lo incluyen y no se descuenta otra vez.
  const despues = saldosTras(
    registro.nueva ? preparado.filas : [],
    Object.fromEntries(saldosCuentas.map((c) => [c.id, c.saldoCentavos])),
    { [sobre.id]: saldoSobre },
  );
  const gasto = preparado.filas.find((f) => f.tipo === "gasto") ?? preparado.filas[0];
  const cuentaDelGasto = cuentas.find((c) => c.id === gasto.cuentaOrigenId);
  const transferencia = preparado.filas.find((f) => f.tipo === "transferencia");

  for (const ruta of ["/", "/movimientos", "/sobres", `/sobres/${sobre.id}`, "/cuentas", "/nuevo/gasto"]) {
    revalidatePath(ruta);
  }

  return {
    estado: "guardado",
    forma: valores.forma,
    cuentaId: valores.cuentaId,
    cuentaVentaId: valores.cuentaVentaId,
    siguienteCaptura: crypto.randomUUID(),
    resumen: {
      montoCentavos: gasto.montoCentavos,
      moneda: gasto.moneda,
      montoUsdCentavos: gasto.montoUsdCentavos,
      categoria: categoria.nombre,
      cuenta: cuentaDelGasto?.nombre ?? "",
      sobre: sobre.nombre,
      sobreDespuesCentavos: despues.sobres[sobre.id],
      bolivaresDespuesCentavos: valores.forma === "dolares" || !bolivares ? null : despues.cuentas[bolivares.id],
      venta: transferencia
        ? {
            montoCentavos: transferencia.montoCentavos,
            moneda: transferencia.moneda,
            cuenta: cuentaOrigen?.nombre ?? "",
            vueltoCentavos: (transferencia.montoDestinoCentavos ?? 0) - gasto.montoCentavos,
          }
        : null,
    },
  };
}
