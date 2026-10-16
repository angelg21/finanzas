import { describe, expect, it } from "vitest";
import { nivelDeSobre, nivelParaIcono, pasoDeSobre } from "./sobres";

const vacio = { topeCentavos: null, anualCentavos: null, fijoMensualCentavos: null };

describe("nivelDeSobre: cuánto de lleno está un sobre, para su icono", () => {
  it("Deudas se llena hacia lo que se debe: el pendiente de las deudas abiertas que debo (spec 005)", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 135_00, debidoCentavos: 520_00 })).toEqual({
      porcentaje: 25,
      alcanzado: false,
      negativo: false,
    });
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 770_00, debidoCentavos: 770_00 })).toMatchObject({
      porcentaje: 100,
      alcanzado: true,
    });
  });

  it("nivelParaIcono: un sobre que no es Deudas, con lo debido sin definir, conserva su medida", () => {
    expect(
      nivelParaIcono({ ...vacio, saldoCentavos: 112_50, fijoMensualCentavos: 450_00, debidoCentavos: undefined }),
    ).toMatchObject({ porcentaje: 25 });
  });

  it("sin deudas, Deudas no tiene contra qué medirse", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 50_00, debidoCentavos: 0 }).porcentaje).toBeNull();
  });

  it("con tope (Emergencia, una meta), lo que lleva hacia el tope", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 2_050_00, topeCentavos: 2_700_00 })).toEqual({
      porcentaje: 75,
      alcanzado: false,
      negativo: false,
    });
  });

  it("al llegar al tope o pasarlo, lleno y alcanzado", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 2_700_00, topeCentavos: 2_700_00 })).toMatchObject({
      porcentaje: 100,
      alcanzado: true,
    });
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 3_000_00, topeCentavos: 2_700_00 })).toMatchObject({
      porcentaje: 100,
      alcanzado: true,
    });
  });

  it("un fondo con desglose se mide contra lo que pide el año, antes que contra su aporte", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 35_00, anualCentavos: 140_00, fijoMensualCentavos: 12_00 })).toEqual(
      { porcentaje: 25, alcanzado: false, negativo: false },
    );
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 140_00, anualCentavos: 140_00 })).toMatchObject({
      alcanzado: true,
    });
  });

  it("con un fijo mensual (Gastos del mes, Familia), lo que queda frente al fijo: se vacía al gastar, sin 'alcanzado'", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 112_50, fijoMensualCentavos: 450_00 })).toEqual({
      porcentaje: 25,
      alcanzado: false,
      negativo: false,
    });
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 633_00, fijoMensualCentavos: 450_00 })).toEqual({
      porcentaje: 100,
      alcanzado: false,
      negativo: false,
    });
  });

  it("el porcentaje es entero y se redondea hacia abajo: nunca dice lleno sin estarlo", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 2_699_99, topeCentavos: 2_700_00 })).toMatchObject({
      porcentaje: 99,
      alcanzado: false,
    });
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 1, topeCentavos: 2_700_00 }).porcentaje).toBe(0);
  });

  it("en negativo, vacío y marcado, tenga o no medida", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: -5_00, fijoMensualCentavos: 450_00 })).toEqual({
      porcentaje: 0,
      alcanzado: false,
      negativo: true,
    });
    expect(nivelDeSobre({ ...vacio, saldoCentavos: -1 })).toEqual({ porcentaje: 0, alcanzado: false, negativo: true });
  });

  it("sin nada contra qué medirlo (Inversión, una meta sin monto), no hay porcentaje", () => {
    expect(nivelDeSobre({ ...vacio, saldoCentavos: 1_400_00 })).toEqual({
      porcentaje: null,
      alcanzado: false,
      negativo: false,
    });
  });

  it("una medida de cero o negativa no cuenta como medida", () => {
    expect(
      nivelDeSobre({ ...vacio, saldoCentavos: 10_00, topeCentavos: 0, fijoMensualCentavos: 0 }).porcentaje,
    ).toBeNull();
  });

  it("lanza con centavos que no son enteros", () => {
    expect(() => nivelDeSobre({ ...vacio, saldoCentavos: 1.5 })).toThrow();
    expect(() => nivelDeSobre({ ...vacio, saldoCentavos: 1, topeCentavos: 0.5 })).toThrow();
  });
});

describe("nivelParaIcono: el icono nunca tumba la pantalla que lo pinta", () => {
  it("con medidas en enteros, el mismo nivel que nivelDeSobre", () => {
    const medida = { ...vacio, saldoCentavos: 2_050_00, topeCentavos: 2_700_00 };
    expect(nivelParaIcono(medida)).toEqual(nivelDeSobre(medida));
    expect(nivelParaIcono({ ...vacio, saldoCentavos: -5_00 })).toEqual(
      nivelDeSobre({ ...vacio, saldoCentavos: -5_00 }),
    );
  });

  it("con una medida que no es un entero seguro, sin porcentaje y sin lanzar (ni el monto en un error)", () => {
    const sinMedida = { porcentaje: null, alcanzado: false, negativo: false };
    expect(nivelParaIcono({ ...vacio, saldoCentavos: 10_00, topeCentavos: 2 ** 53 + 2 })).toEqual(sinMedida);
    expect(nivelParaIcono({ ...vacio, saldoCentavos: 10_00, anualCentavos: 1.8e19 })).toEqual(sinMedida);
    expect(nivelParaIcono({ ...vacio, saldoCentavos: 1.5, fijoMensualCentavos: 450_00 })).toEqual(sinMedida);
  });
});

describe("pasoDeSobre: el color del anillo de Sobres sigue al tipo de sobre", () => {
  it("cada tipo con su paso, y uno desconocido con el de las metas", () => {
    expect(["emergencia", "inversion", "meta", "gastos", "familia", "fondo", "otro"].map(pasoDeSobre)).toEqual([
      1, 2, 3, 4, 5, 6, 3,
    ]);
  });

  it("Deudas lleva su propio paso, la rejilla, distinto del de cada otro tipo del anillo (spec 005)", () => {
    expect(pasoDeSobre("deudas")).toBe(7);
    const delAnillo = ["emergencia", "inversion", "meta", "gastos", "familia", "fondo", "deudas"].map(pasoDeSobre);
    expect(new Set(delAnillo).size).toBe(delAnillo.length);
  });
});
