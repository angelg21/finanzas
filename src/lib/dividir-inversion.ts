import { claveDeNombre } from "./categorias";

/**
 * Dividir Inversión en largo plazo y negocios (spec 015), sin base ni React: cómo se parte la regla y qué hay que
 * cambiar según cómo esté la base. Lo aplica src/db/dividir-inversion.ts en una transacción, comparando saldos.
 */

/** El nombre nuevo del sobre de inversión, si todavía se llama como lo creó la semilla. */
export const nombreViejo = "Inversión";
export const nombreLargoPlazo = "Inversión a largo plazo";
export const notaLargoPlazo = "S&P 500, oro y renta variable a largo plazo. Intocable: nunca se retira.";
export const sobreNegocios = {
  nombre: "Negocios",
  tipo: "negocios",
  nota: "Oportunidades de negocio de ahora: se usa cuando aparece una.",
} as const;

/**
 * Criterio 5: 2/3 para largo plazo y 1/3 para negocios, con el tercio redondeado al entero más cercano y el resto a
 * largo plazo, así que suman exactamente lo de antes. Sirve igual para puntos base (porcentaje) que para centavos
 * (fijo). Solo enteros: el resto de dividir por 3 decide el redondeo.
 */
export function dividirRegla(valor: number): { largoPlazo: number; negocios: number } {
  if (!Number.isSafeInteger(valor) || valor <= 0) throw new RangeError(`Regla inválida: ${valor}`);
  const resto = valor % 3;
  const negocios = (valor - resto) / 3 + (resto === 2 ? 1 : 0);
  return { largoPlazo: valor - negocios, negocios };
}

type SobreActual = { id: number; nombre: string; tipo: string; orden: number };
type ReglaActual = { sobreId: number; tipo: "fijo" | "porcentaje"; valor: number; orden: number; activa: boolean };

export type PlanDeDivision =
  | { estado: "ya-dividido" }
  | { estado: "sin-inversion" }
  | { estado: "nombre-ocupado"; nombre: string }
  | {
      estado: "dividir";
      inversionId: number;
      /** El nombre nuevo, o null si el desarrollador ya le puso uno propio. */
      renombrarA: string | null;
      /** El sobre nuevo, con la orden de Inversión: va justo detrás (id mayor), como Deudas detrás de Ocasiones. */
      negocios: { nombre: string; tipo: "negocios"; orden: number; nota: string };
      /** La regla de Inversión partida, o null si no tenía una activa. `negocios` null: el tercio daría 0. */
      regla: {
        tipo: "fijo" | "porcentaje";
        antes: number;
        largoPlazo: number;
        negocios: number | null;
        orden: number;
      } | null;
    };

/** Criterios 2 a 4: qué cambiar, o por qué no. Idempotente: con un sobre de negocios ya creado, nada. */
export function planDeDivision(sobres: SobreActual[], reglas: ReglaActual[]): PlanDeDivision {
  if (sobres.some((s) => s.tipo === "negocios")) return { estado: "ya-dividido" };
  const inversion = sobres.find((s) => s.tipo === "inversion");
  if (!inversion) return { estado: "sin-inversion" };
  if (sobres.some((s) => claveDeNombre(s.nombre) === claveDeNombre(sobreNegocios.nombre))) {
    return { estado: "nombre-ocupado", nombre: sobreNegocios.nombre };
  }
  const libre = !sobres.some((s) => claveDeNombre(s.nombre) === claveDeNombre(nombreLargoPlazo));
  const actual = reglas.find((r) => r.sobreId === inversion.id && r.activa);
  const partida = actual ? dividirRegla(actual.valor) : null;
  return {
    estado: "dividir",
    inversionId: inversion.id,
    renombrarA: inversion.nombre === nombreViejo && libre ? nombreLargoPlazo : null,
    negocios: { ...sobreNegocios, orden: inversion.orden },
    regla:
      actual && partida
        ? {
            tipo: actual.tipo,
            antes: actual.valor,
            largoPlazo: partida.largoPlazo,
            negocios: partida.negocios > 0 ? partida.negocios : null,
            orden: actual.orden,
          }
        : null,
  };
}
