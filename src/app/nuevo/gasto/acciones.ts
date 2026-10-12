"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categoriasDeGastoPorUso, saldosPorCuenta, sobresParaGasto } from "@/db/consultas";
import { registrarMovimientos } from "@/db/movimientos";
import type { Moneda } from "@/lib/dinero";
import { hoyEnCaracas } from "@/lib/fechas";
import { type ErroresGasto, type FormaPago, prepararGasto, saldosTras } from "@/lib/gastos";

/** Lo que se tecleó, para volver a llenar el formulario si hay que corregir o confirmar. */
export type ValoresGasto = {
  forma: FormaPago;
  monto: string;
  tasa: string;
  vendido: string;
  cuentaId: string;
  categoriaId: string;
  sobreId: string;
  fecha: string;
  nota: string;
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
};

type Resultado =
  | { estado: "error"; errores: ErroresFormularioGasto; valores: ValoresGasto }
  /** Sobre Inversión: hace falta un segundo clic (criterio 9). */
  | { estado: "confirmar"; valores: ValoresGasto }
  /** "Registrar otro" reabre con la misma forma de pago y la misma cuenta. */
  | { estado: "guardado"; resumen: ResumenGasto; forma: FormaPago; cuentaId: string };

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
  categoriaId: z.string(),
  sobreId: z.string(),
  fecha: z.string().trim(),
  nota: z.string().trim().max(200, "La nota admite hasta 200 caracteres"),
});

/** Un campo como texto; si falta, vacío. */
function campo(formData: FormData, nombre: keyof ValoresGasto | "confirmarSobre") {
  const valor = formData.get(nombre);
  return typeof valor === "string" ? valor : "";
}

/** Registra un gasto (spec 001). Para `useActionState`. */
export async function registrarGasto(previo: EstadoGasto, formData: FormData): Promise<EstadoGasto> {
  return { ronda: (previo?.ronda ?? 0) + 1, ...(await procesarGasto(formData)) };
}

/**
 * Nada del formulario se cree a ciegas: el sobre, la categoría y las cuentas se buscan en la base entre
 * los activos y aptos, y la moneda sale de la cuenta, no del formulario. El check de la base solo valida
 * la forma de la fila, no que el sobre sea "Por asignar" o la categoría de ingreso.
 */
async function procesarGasto(formData: FormData): Promise<Resultado> {
  const tecleado = {
    forma: campo(formData, "forma"),
    monto: campo(formData, "monto"),
    tasa: campo(formData, "tasa"),
    vendido: campo(formData, "vendido"),
    cuentaId: campo(formData, "cuentaId"),
    categoriaId: campo(formData, "categoriaId"),
    sobreId: campo(formData, "sobreId"),
    fecha: campo(formData, "fecha"),
    nota: campo(formData, "nota"),
  };
  /** Id del sobre Inversión cuando ya se confirmó el aviso. */
  const confirmarSobre = campo(formData, "confirmarSobre");
  const leido = esquema.safeParse(tecleado);
  if (!leido.success) {
    // Se devuelve lo tecleado para no vaciar el formulario.
    return {
      estado: "error",
      errores: { general: leido.error.issues[0]?.message ?? "Revisa los datos del formulario" },
      valores: { ...tecleado, forma: formas.safeParse(tecleado.forma).data ?? "dolares" },
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
  const cuentaOrigen = cuentas.find((c) => String(c.id) === valores.cuentaId && c.moneda !== "VES");
  const bolivares = cuentas.find((c) => c.moneda === "VES") ?? null;

  const preparado = prepararGasto(
    {
      ...valores,
      // Sin cuenta válida, una en bolívares hace que prepararGasto pida "Elige una cuenta en dólares".
      cuentaOrigen: cuentaOrigen ?? { id: 0, moneda: "VES" },
      cuentaBolivares: bolivares,
      sobreId: sobre?.id ?? 0,
      categoriaId: categoria?.id ?? 0,
    },
    hoyEnCaracas(new Date()),
  );

  const errores: ErroresFormularioGasto = preparado.ok ? {} : { ...preparado.errores };
  if (!categoria) errores.categoria = "Elige una categoría";
  if (!sobre) errores.sobre = "Elige un sobre";
  if (!preparado.ok || !categoria || !sobre) return { estado: "error", errores, valores };

  if (sobre.tipo === "inversion" && confirmarSobre !== String(sobre.id)) return { estado: "confirmar", valores };

  try {
    await registrarMovimientos(preparado.filas);
  } catch (error) {
    console.error("No se pudo registrar el gasto", error);
    return { estado: "error", errores: { general: "No se pudo guardar. Intenta de nuevo." }, valores };
  }

  // Los saldos tras el gasto se calculan con los que ya se leyeron: sin otra consulta en la captura.
  const despues = saldosTras(preparado.filas, Object.fromEntries(cuentas.map((c) => [c.id, c.saldoCentavos])), {
    [sobre.id]: sobre.saldoCentavos,
  });
  const gasto = preparado.filas.find((f) => f.tipo === "gasto") ?? preparado.filas[0];
  const cuentaDelGasto = cuentas.find((c) => c.id === gasto.cuentaOrigenId);

  for (const ruta of ["/", "/movimientos", "/sobres", `/sobres/${sobre.id}`, "/cuentas", "/nuevo/gasto"]) {
    revalidatePath(ruta);
  }

  return {
    estado: "guardado",
    forma: valores.forma,
    cuentaId: valores.cuentaId,
    resumen: {
      montoCentavos: gasto.montoCentavos,
      moneda: gasto.moneda,
      montoUsdCentavos: gasto.montoUsdCentavos,
      categoria: categoria.nombre,
      cuenta: cuentaDelGasto?.nombre ?? "",
      sobre: sobre.nombre,
      sobreDespuesCentavos: despues.sobres[sobre.id],
      bolivaresDespuesCentavos: valores.forma === "dolares" || !bolivares ? null : despues.cuentas[bolivares.id],
    },
  };
}
