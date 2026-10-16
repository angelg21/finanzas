/**
 * Criterio 11 de la spec 005: cuánto debe recibir Deudas este mes para tener cada deuda lista al empezar el mes de su
 * fecha. El ejemplo de reparto con Deudas (criterio 12) vive en reparto.criterios.test.ts.
 */
import { describe, expect, it } from "vitest";
import { type DeudaParaCuota, cuotaDeDeudas, reglaDeDeudas } from "./cuota-deudas";

const hoy = "2026-10-15";
const amigo: DeudaParaCuota = { sentido: "debo", pendienteCentavos: 25_000, fechaPrevista: "2026-10-22" };
const papas: DeudaParaCuota = { sentido: "debo", pendienteCentavos: 52_000, fechaPrevista: "2026-12-15" };

describe("cuotaDeDeudas: el caso real (criterio 11)", () => {
  it("hoy 15 de octubre, sin nada apartado: octubre pide 250,00 y diciembre 770,00 / 2; la cuota es 385,00", () => {
    expect(cuotaDeDeudas({ deudas: [amigo, papas], apartado: 0, hoy })).toBe(38_500);
  });

  it("en noviembre, con el amigo pagado y Deudas en 135,00, la cuota sigue en 385,00 y diciembre empieza con 520,00", () => {
    const cuota = cuotaDeDeudas({ deudas: [papas], apartado: 13_500, hoy: "2026-11-03" });
    expect(cuota).toBe(38_500);
    expect(13_500 + cuota).toBe(papas.pendienteCentavos);
  });

  it("con 770,00 apartados hoy, la cuota es 0", () => {
    expect(cuotaDeDeudas({ deudas: [amigo, papas], apartado: 77_000, hoy })).toBe(0);
  });

  it("con 300,00 apartados, es 235,00", () => {
    expect(cuotaDeDeudas({ deudas: [amigo, papas], apartado: 30_000, hoy })).toBe(23_500);
  });

  it("dentro del mes no cambia: un pago baja lo que se debe y lo apartado al empezar el mes por igual", () => {
    // Octubre recibió 385,00 y pagó al amigo: Deudas tiene 135,00, y al empezar el mes tenía 135,00 − 385,00.
    expect(cuotaDeDeudas({ deudas: [papas], apartado: 13_500 - 38_500, hoy: "2026-10-28" })).toBe(38_500);
  });
});

describe("cuotaDeDeudas: qué deudas piden cuota", () => {
  it("las que no tienen fecha no piden cuota: se apartan a mano", () => {
    expect(cuotaDeDeudas({ deudas: [{ ...papas, fechaPrevista: null }], apartado: 0, hoy })).toBe(0);
  });

  it("las pagadas y lo que me deben no cuentan", () => {
    expect(cuotaDeDeudas({ deudas: [{ ...amigo, pendienteCentavos: 0 }], apartado: 0, hoy })).toBe(0);
    expect(cuotaDeDeudas({ deudas: [{ ...amigo, sentido: "me_deben" }], apartado: 0, hoy })).toBe(0);
  });

  it("sin deudas, cero", () => {
    expect(cuotaDeDeudas({ deudas: [], apartado: 0, hoy })).toBe(0);
  });

  it("una deuda vencida o de este mes pide todo ahora", () => {
    expect(cuotaDeDeudas({ deudas: [{ ...amigo, fechaPrevista: "2026-08-01" }], apartado: 0, hoy })).toBe(25_000);
    expect(cuotaDeDeudas({ deudas: [{ ...amigo, fechaPrevista: "2026-10-01" }], apartado: 5_000, hoy })).toBe(20_000);
  });

  it("varias deudas del mismo mes se suman", () => {
    const otra = { ...papas, pendienteCentavos: 8_000 };
    expect(cuotaDeDeudas({ deudas: [papas, otra], apartado: 0, hoy })).toBe(30_000);
  });

  it("es la mayor de las necesidades: una lejana grande puede pedir más que una cercana chica", () => {
    const cercana = { ...amigo, pendienteCentavos: 1_000 };
    const lejana = { ...papas, pendienteCentavos: 120_000, fechaPrevista: "2027-01-10" };
    // Octubre pide 10,00; enero, 1.210,00 / 3 = 403,34 → 404,00.
    expect(cuotaDeDeudas({ deudas: [cercana, lejana], apartado: 0, hoy })).toBe(40_400);
  });

  it("si Deudas empezó el mes en negativo, la cuota también lo repone", () => {
    expect(cuotaDeDeudas({ deudas: [papas], apartado: -11_500, hoy: "2026-11-03" })).toBe(63_500);
  });
});

describe("cuotaDeDeudas: el redondeo", () => {
  it("hacia arriba al dólar, como el aporte de los fondos", () => {
    const d = { ...papas, pendienteCentavos: 10_001 };
    expect(cuotaDeDeudas({ deudas: [d], apartado: 0, hoy })).toBe(5_100);
  });

  it("sin pasar de lo que falta", () => {
    const d = { ...amigo, pendienteCentavos: 50 };
    expect(cuotaDeDeudas({ deudas: [d], apartado: 0, hoy })).toBe(50);
    const casi = { ...papas, pendienteCentavos: 10_050 };
    expect(cuotaDeDeudas({ deudas: [casi], apartado: 10_000, hoy })).toBe(50);
  });
});

describe("cuotaDeDeudas: el cambio de año", () => {
  it("de noviembre a febrero son tres meses", () => {
    const d = { ...papas, pendienteCentavos: 90_000, fechaPrevista: "2027-02-10" };
    expect(cuotaDeDeudas({ deudas: [d], apartado: 0, hoy: "2026-11-20" })).toBe(30_000);
  });

  it("de diciembre a enero es uno", () => {
    const d = { ...papas, fechaPrevista: "2027-01-31" };
    expect(cuotaDeDeudas({ deudas: [d], apartado: 0, hoy: "2026-12-31" })).toBe(52_000);
  });
});

describe("cuotaDeDeudas: entradas inválidas lanzan", () => {
  it("un pendiente que no es un entero de centavos no negativo", () => {
    for (const pendienteCentavos of [-1, 0.5, Number.NaN]) {
      expect(() => cuotaDeDeudas({ deudas: [{ ...papas, pendienteCentavos }], apartado: 0, hoy })).toThrow(RangeError);
    }
  });

  it("una fecha prevista o un hoy que no son días reales", () => {
    expect(() => cuotaDeDeudas({ deudas: [{ ...papas, fechaPrevista: "2026-02-30" }], apartado: 0, hoy })).toThrow(
      RangeError,
    );
    expect(() => cuotaDeDeudas({ deudas: [papas], apartado: 0, hoy: "hoy" })).toThrow(RangeError);
  });

  it("lo apartado, si no es un entero", () => {
    expect(() => cuotaDeDeudas({ deudas: [papas], apartado: 1.5, hoy })).toThrow(RangeError);
  });
});

describe("reglaDeDeudas: la cuota como una regla fija más (criterio 12)", () => {
  const reglas = [
    { sobreId: 2, orden: 1, tipo: "fijo" as const, valor: 45_000, topeCentavos: null },
    { sobreId: 7, orden: 4, tipo: "porcentaje" as const, valor: 4_000, topeCentavos: 270_000 },
  ];

  it("fija, con la cuota como valor y un orden menor que el de todas las demás", () => {
    expect(reglaDeDeudas(12, 38_500, reglas)).toEqual({
      sobreId: 12,
      orden: 0,
      tipo: "fijo",
      valor: 38_500,
      topeCentavos: null,
    });
    expect(reglaDeDeudas(12, 38_500, [{ ...reglas[0], orden: -3 }])?.orden).toBe(-4);
  });

  it("con cuota 0 no hay regla", () => {
    expect(reglaDeDeudas(12, 0, reglas)).toBeNull();
  });
});
