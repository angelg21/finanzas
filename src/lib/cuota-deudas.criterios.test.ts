/**
 * Criterios ★ 11 y 12 de la spec 005 (la cuota del mes y Deudas en el reparto) en lo que cumplen las funciones puras,
 * escritos desde el texto de cada criterio. Las pruebas de construcción viven en cuota-deudas.test.ts, y el ejemplo de
 * 1.200,00 del ★ 12 en reparto.criterios.test.ts. Que la cuota no cambie dentro del mes, y que Deudas vaya primero en
 * el reparto de la base, lo comprueban scripts/comprobar-005.ts y scripts/comprobar-005-criterios.ts.
 */
import { describe, expect, it } from "vitest";
import { type DeudaParaCuota, cuotaDeDeudas, pistaDeCuota, reglaDeDeudas } from "./cuota-deudas";
import type { ReglaParaRepartir } from "./reparto";

const debo = (pendienteCentavos: number, fechaPrevista: string | null): DeudaParaCuota => ({
  sentido: "debo",
  pendienteCentavos,
  fechaPrevista,
});
const amigo = debo(25_000, "2026-10-22");
const papas = debo(52_000, "2026-12-15");
const hoy = "2026-10-15";

describe("★ 11 · la cuota del mes", () => {
  it("el caso real: octubre pide 250,00, diciembre 770,00 / 2 = 385,00; la cuota es 385,00", () => {
    expect(cuotaDeDeudas({ deudas: [amigo], apartado: 0, hoy })).toBe(25_000);
    expect(cuotaDeDeudas({ deudas: [amigo, papas], apartado: 0, hoy })).toBe(38_500);
  });

  it("en noviembre, con el amigo pagado y 135,00 apartados, pide 385,00 y diciembre empieza con 520,00", () => {
    const cuota = cuotaDeDeudas({ deudas: [debo(0, "2026-10-22"), papas], apartado: 13_500, hoy: "2026-11-03" });
    expect(cuota).toBe(38_500);
    expect(13_500 + cuota).toBe(52_000);
  });

  it("con 770,00 apartados la cuota es 0; con 300,00, 235,00", () => {
    expect(cuotaDeDeudas({ deudas: [amigo, papas], apartado: 77_000, hoy })).toBe(0);
    expect(cuotaDeDeudas({ deudas: [amigo, papas], apartado: 30_000, hoy })).toBe(23_500);
  });

  it("es la mayor de las necesidades: una deuda cercana grande manda sobre una lejana", () => {
    expect(cuotaDeDeudas({ deudas: [debo(50_000, "2026-10-30"), debo(20_000, "2026-12-15")], apartado: 0, hoy })).toBe(
      50_000,
    );
  });

  it("solo entran las abiertas que debo y que tienen fecha", () => {
    const sinFecha = debo(14_000, null);
    const meDeben: DeudaParaCuota = { sentido: "me_deben", pendienteCentavos: 14_000, fechaPrevista: "2026-10-20" };
    const pagada = debo(0, "2026-10-20");
    expect(cuotaDeDeudas({ deudas: [sinFecha, meDeben, pagada], apartado: 0, hoy })).toBe(0);
    expect(cuotaDeDeudas({ deudas: [amigo, papas, sinFecha, meDeben, pagada], apartado: 0, hoy })).toBe(38_500);
  });

  it("una deuda vencida o de este mes pide todo ahora", () => {
    expect(cuotaDeDeudas({ deudas: [debo(10_000, "2026-09-10")], apartado: 0, hoy })).toBe(10_000);
    expect(cuotaDeDeudas({ deudas: [debo(10_000, "2025-01-10")], apartado: 0, hoy })).toBe(10_000);
    expect(cuotaDeDeudas({ deudas: [debo(10_000, "2026-10-31")], apartado: 0, hoy })).toBe(10_000);
  });

  it("redondea hacia arriba al dólar, sin pasar de lo que falta", () => {
    // 100,01 en dos meses: 50,005 sube a 51,00.
    expect(cuotaDeDeudas({ deudas: [debo(10_001, "2026-12-01")], apartado: 0, hoy })).toBe(5_100);
    // 100,50 este mes: al dólar serían 101,00, pero solo faltan 100,50.
    expect(cuotaDeDeudas({ deudas: [debo(10_050, "2026-10-20")], apartado: 0, hoy })).toBe(10_050);
    // Faltan 0,40 en tres meses: al dólar sería 1,00, pero solo faltan 0,40.
    expect(cuotaDeDeudas({ deudas: [debo(10_000, "2027-01-05")], apartado: 9_960, hoy })).toBe(40);
  });

  it("nunca es menor que 0, aunque lo apartado pase de lo que se debe", () => {
    expect(cuotaDeDeudas({ deudas: [amigo], apartado: 90_000, hoy })).toBe(0);
    expect(cuotaDeDeudas({ deudas: [], apartado: 0, hoy })).toBe(0);
  });

  it("si Deudas empezó el mes en negativo, la cuota también lo repone", () => {
    expect(cuotaDeDeudas({ deudas: [amigo], apartado: -11_500, hoy })).toBe(36_500);
  });

  it("cuenta los meses a través del cambio de año", () => {
    expect(cuotaDeDeudas({ deudas: [debo(30_000, "2027-02-15")], apartado: 0, hoy: "2026-12-10" })).toBe(15_000);
    expect(cuotaDeDeudas({ deudas: [debo(30_000, "2027-01-15")], apartado: 0, hoy: "2026-12-10" })).toBe(30_000);
  });

  it("lanza con entradas inválidas", () => {
    expect(() => cuotaDeDeudas({ deudas: [], apartado: 0, hoy: "2026-13-01" })).toThrow();
    expect(() => cuotaDeDeudas({ deudas: [debo(100, "2026-02-30")], apartado: 0, hoy })).toThrow();
    expect(() => cuotaDeDeudas({ deudas: [debo(-1, "2026-12-01")], apartado: 0, hoy })).toThrow();
    expect(() => cuotaDeDeudas({ deudas: [debo(1.5, "2026-12-01")], apartado: 0, hoy })).toThrow();
    expect(() => cuotaDeDeudas({ deudas: [], apartado: 0.5, hoy })).toThrow();
  });
});

describe("★ 12 · Deudas en el reparto", () => {
  const sembradas: ReglaParaRepartir[] = [
    { sobreId: 2, orden: 1, tipo: "fijo", valor: 45_000, topeCentavos: null },
    { sobreId: 3, orden: 2, tipo: "fijo", valor: 10_000, topeCentavos: null },
    { sobreId: 7, orden: 4, tipo: "porcentaje", valor: 4_000, topeCentavos: 270_000 },
  ];

  it("es una regla fija que vale la cuota y va antes que todas las demás", () => {
    const regla = reglaDeDeudas(10, 38_500, sembradas);
    expect(regla).toMatchObject({ sobreId: 10, tipo: "fijo", valor: 38_500, topeCentavos: null });
    for (const r of sembradas) expect(regla!.orden).toBeLessThan(r.orden);
  });

  it("con cuota 0 no tiene fila", () => {
    expect(reglaDeDeudas(10, 0, sembradas)).toBeNull();
  });

  it('su pista dice "cuota · faltan 385 este mes · vence 22 oct"', () => {
    expect(pistaDeCuota(38_500, 0, "2026-10-22", hoy)).toBe("cuota · faltan 385 este mes · vence 22 oct");
  });

  it("lo que falta es la cuota menos lo recibido desde Por asignar en el mes", () => {
    expect(pistaDeCuota(38_500, 10_000, "2026-10-22", hoy)).toContain("faltan 285 este mes");
  });
});
