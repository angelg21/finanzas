import { describe, expect, it } from "vitest";
import {
  aCentavos,
  aCentavosExactos,
  leerExacto,
  aTasa,
  bolivaresDesdeUsd,
  centavosATexto,
  formatearCentavos,
  formatearTasaGuardada,
  formatearEnteros,
  formatearTasa,
  partesCentavos,
  repartirHaciaArriba,
  tasaDecimal,
  unidadDe,
  usdDesdeBolivares,
} from "./dinero";

describe("aCentavos", () => {
  it("acepta formato venezolano con punto de miles y coma decimal", () => {
    expect(aCentavos("1.234,56")).toBe(123_456);
  });
  it("acepta formato con punto decimal", () => {
    expect(aCentavos("1234.56")).toBe(123_456);
    expect(aCentavos("1234,56")).toBe(123_456);
  });
  it("sin coma, un punto solo es decimal: no hay separador de miles", () => {
    expect(aCentavos("2100")).toBe(210_000);
    expect(aCentavos("2.100")).toBe(210);
  });
  it("acepta enteros y espacios", () => {
    expect(aCentavos(" 40 ")).toBe(4_000);
  });
  it("redondea a centavos sin errores de coma flotante", () => {
    expect(aCentavos("0,1")).toBe(10);
    expect(aCentavos("19.99")).toBe(1_999);
  });
  it("rechaza lo que no es número", () => {
    expect(() => aCentavos("abc")).toThrow();
    expect(() => aCentavos("")).toThrow();
  });
  it("rechaza notación científica, hexadecimal y binaria: solo cifras y un decimal", () => {
    for (const texto of ["1e3", "0x10", "0b11", "Infinity", "1.2.3", "1,2,3", "+5", ".", "-"]) {
      expect(() => aCentavos(texto), texto).toThrow();
    }
  });
  it("redondea el tercer decimal sin coma flotante, las mitades hacia arriba", () => {
    expect(aCentavos("1.005")).toBe(101);
    expect(aCentavos("1,004")).toBe(100);
    expect(aCentavos("0,125")).toBe(13);
  });
  it("rechaza montos que no caben en un entero seguro", () => {
    expect(() => aCentavos("999999999999999999")).toThrow();
  });
});

describe("formatearCentavos y partesCentavos", () => {
  it("formatea con separadores locales y unidad", () => {
    expect(formatearCentavos(123_456)).toBe("1.234,56 USD");
    expect(formatearCentavos(50_000, "VES")).toBe("500,00 Bs");
  });
  it("muestra el signo menos en negativos y lo separa en partes", () => {
    expect(formatearCentavos(-123_456)).toBe("−1.234,56 USD");
    expect(partesCentavos(-5)).toMatchObject({ entero: "0", decimales: "05", negativo: true });
  });
  it("unidadDe muestra Bs para los bolívares y el código para lo demás", () => {
    expect(unidadDe("VES")).toBe("Bs");
    expect(unidadDe("USDT")).toBe("USDT");
  });
  it("formatearEnteros redondea al dólar", () => {
    expect(formatearEnteros(123_456)).toBe("1.235");
  });
});

describe("aTasa", () => {
  it("devuelve la tasa en diezmilésimas, con coma o punto decimal", () => {
    expect(aTasa("241,8")).toBe(2_418_000);
    expect(aTasa("241.8")).toBe(2_418_000);
    expect(aTasa(" 240 ")).toBe(2_400_000);
    expect(aTasa("36,5432")).toBe(365_432);
  });
  it("redondea a cuatro decimales, que es lo que guarda la base", () => {
    expect(aTasa("241,81236")).toBe(2_418_124);
  });
  it("rechaza vacío, texto, cero y negativo", () => {
    expect(() => aTasa("")).toThrow();
    expect(() => aTasa("abc")).toThrow();
    expect(() => aTasa("0")).toThrow();
    expect(() => aTasa("0,00")).toThrow();
    expect(() => aTasa("0,00001")).toThrow();
    expect(() => aTasa("-5")).toThrow();
  });
  it("rechaza notación científica y hexadecimal", () => {
    expect(() => aTasa("1e3")).toThrow();
    expect(() => aTasa("0x10")).toThrow();
  });
  it("rechaza tasas que no caben en numeric(14,4)", () => {
    expect(() => aTasa("10000000000")).toThrow();
  });
});

describe("bolivaresDesdeUsd", () => {
  it("convierte los dólares vendidos a bolívares (criterios 2 y 4)", () => {
    expect(bolivaresDesdeUsd(2_000, 2_418_000)).toBe(483_600);
    expect(bolivaresDesdeUsd(1_000, 2_400_000)).toBe(240_000);
  });
  it("redondea al centavo, las mitades hacia arriba", () => {
    expect(bolivaresDesdeUsd(1, 2_418_000)).toBe(242);
    expect(bolivaresDesdeUsd(1, 5_000)).toBe(1);
  });
  it("0 USD son 0 Bs", () => {
    expect(bolivaresDesdeUsd(0, 2_418_000)).toBe(0);
  });
  it("no acepta montos con decimales ni tasas no positivas", () => {
    expect(() => bolivaresDesdeUsd(10.5, 2_418_000)).toThrow();
    expect(() => bolivaresDesdeUsd(1_000, 0)).toThrow();
    expect(() => bolivaresDesdeUsd(1_000, 241.8)).toThrow();
  });
});

describe("usdDesdeBolivares", () => {
  it("valora en dólares el gasto en bolívares (criterios 2, 3 y 4)", () => {
    expect(usdDesdeBolivares(210_000, 2_418_000)).toBe(868);
    expect(usdDesdeBolivares(50_000, 2_418_000)).toBe(207);
    expect(usdDesdeBolivares(250_000, 2_400_000)).toBe(1_042);
  });
  it("redondea al centavo, las mitades hacia arriba", () => {
    expect(usdDesdeBolivares(5, 100_000)).toBe(1);
    expect(usdDesdeBolivares(4, 100_000)).toBe(0);
  });
  it("0 Bs son 0 USD, y menos de medio centavo también", () => {
    expect(usdDesdeBolivares(0, 2_418_000)).toBe(0);
    expect(usdDesdeBolivares(100, 2_418_000)).toBe(0);
  });
  it("no acepta montos con decimales ni tasas no positivas", () => {
    expect(() => usdDesdeBolivares(0.5, 2_418_000)).toThrow();
    expect(() => usdDesdeBolivares(1_000, -1)).toThrow();
  });
});

describe("tasaDecimal", () => {
  it("escribe la tasa con cuatro decimales y punto, como la guarda la base", () => {
    expect(tasaDecimal(2_418_000)).toBe("241.8000");
    expect(tasaDecimal(365_432)).toBe("36.5432");
    expect(tasaDecimal(12_345_000)).toBe("1234.5000");
    expect(tasaDecimal(1)).toBe("0.0001");
  });
});

describe("formatearTasa", () => {
  it("muestra al menos dos decimales y hasta cuatro, con la unidad", () => {
    expect(formatearTasa(2_418_000)).toBe("241,80 Bs/USD");
    expect(formatearTasa(2_400_000)).toBe("240,00 Bs/USD");
    expect(formatearTasa(365_432)).toBe("36,5432 Bs/USD");
    expect(formatearTasa(2_418_130)).toBe("241,813 Bs/USD");
  });
  it("separa los miles", () => {
    expect(formatearTasa(12_345_000)).toBe("1.234,50 Bs/USD");
  });
});

describe("repartirHaciaArriba: un total entre partes, hacia arriba al múltiplo, en enteros", () => {
  it("1.200 USD al año son 100 USD al mes; un centavo más sube al dólar siguiente", () => {
    expect(repartirHaciaArriba(120_000, 12, 100)).toBe(10_000);
    expect(repartirHaciaArriba(120_001, 12, 100)).toBe(10_100);
  });
  it("cero da cero y un centavo ya pide el múltiplo entero", () => {
    expect(repartirHaciaArriba(0, 12, 100)).toBe(0);
    expect(repartirHaciaArriba(1, 12, 100)).toBe(100);
  });
  it("es exacto también en totales enormes, donde la coma flotante ya no lo es", () => {
    const total = 2 ** 53 - 1;
    const esperado = Number(((BigInt(total) + BigInt(1199)) / BigInt(1200)) * BigInt(100));
    expect(repartirHaciaArriba(total, 12, 100)).toBe(esperado);
  });
  it("rechaza lo que no son centavos enteros o partes y múltiplos positivos", () => {
    expect(() => repartirHaciaArriba(10.5, 12, 100)).toThrow(RangeError);
    expect(() => repartirHaciaArriba(100, 0, 100)).toThrow(RangeError);
    expect(() => repartirHaciaArriba(100, 12, 0)).toThrow(RangeError);
  });
});

describe("centavosATexto: el monto como se escribe en un campo, sin pasar por coma flotante (auditoría T14, H4)", () => {
  it("con coma decimal y sin decimales si son cero", () => {
    expect(centavosATexto(2550)).toBe("25,50");
    expect(centavosATexto(2500)).toBe("25");
    expect(centavosATexto(5)).toBe("0,05");
    expect(centavosATexto(0)).toBe("0");
    expect(centavosATexto(-1234)).toBe("-12,34");
  });

  it("vuelve igual por aCentavos en todo el rango, también por encima de lo que aguanta un flotante", () => {
    for (const c of [1, 99, 100, 101, 2_147_483_647, 9_007_199_254_740_991]) {
      expect(aCentavos(centavosATexto(c)), String(c)).toBe(c);
    }
  });
});

describe("formatearTasaGuardada: la tasa de la base, sin tumbar la página si viene rara (auditoría T14)", () => {
  it("formatea la tasa como la guarda numeric(14,4)", () => {
    expect(formatearTasaGuardada("221.4000")).toBe(formatearTasa(2214000));
    expect(formatearTasaGuardada("36.2500")).toBe(formatearTasa(362500));
  });

  it("una tasa cero, negativa o ilegible se muestra tal cual, sin lanzar", () => {
    expect(formatearTasaGuardada("0.0000")).toBe("0.0000");
    expect(formatearTasaGuardada("-5.0000")).toBe("-5.0000");
    expect(formatearTasaGuardada("abc")).toBe("abc");
  });
});

describe("aCentavosExactos: como aCentavos, pero sin redondear fracciones de centavo (spec 004, criterio 8)", () => {
  it("lee igual que aCentavos los montos con hasta dos decimales", () => {
    for (const texto of ["187,50", "1.234,56", "1234.56", "2.100", "25", "0", "-10,5"]) {
      expect(aCentavosExactos(texto), texto).toBe(aCentavos(texto));
    }
  });

  it("acepta ceros de más tras los centavos: 1,500 vale 1,50", () => {
    expect(aCentavosExactos("1,500")).toBe(150);
    expect(aCentavosExactos("10.5000")).toBe(1_050);
  });

  it("lanza si trae fracciones de centavo, en vez de redondear en silencio", () => {
    for (const texto of ["10,555", "0,001", "1.234,567", "3.14159"]) {
      expect(() => aCentavosExactos(texto), texto).toThrow(/decimales/);
    }
  });

  it("lanza como aCentavos con lo vacío o lo que no es número", () => {
    expect(() => aCentavosExactos("")).toThrow();
    expect(() => aCentavosExactos("abc")).toThrow();
  });
});

describe("leerExacto: un monto que se confirma campo por campo, o por qué no se pudo leer", () => {
  it("las centésimas cuando se puede", () => {
    expect(leerExacto("187,50")).toEqual({ ok: true, valor: 18_750 });
    expect(leerExacto("-5")).toEqual({ ok: true, valor: -500 });
  });

  it("vacío, con fracciones de centavo o ilegible, cada uno con su motivo", () => {
    expect(leerExacto("  ")).toEqual({ ok: false, motivo: "vacio" });
    expect(leerExacto("10,555")).toEqual({ ok: false, motivo: "decimales" });
    expect(leerExacto("abc")).toEqual({ ok: false, motivo: "invalido" });
    expect(leerExacto("1e3")).toEqual({ ok: false, motivo: "invalido" });
  });
});
