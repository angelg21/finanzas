import { describe, expect, it } from "vitest";
import {
  consultaDeFiltros,
  esPeriodoActual,
  etiquetaDia,
  etiquetaPeriodo,
  leerFiltros,
  moverPeriodo,
  rangoDePeriodo,
} from "./periodos";

const hoy = "2026-10-14";

describe("rangoDePeriodo", () => {
  it("un día es ese día", () => {
    expect(rangoDePeriodo("dia", "2026-10-14")).toEqual({ desde: "2026-10-14", hasta: "2026-10-14" });
  });

  it("la semana va de lunes a domingo, también cuando cruza el mes", () => {
    // El 31 de octubre de 2026 es sábado: su semana va del lunes 26 al domingo 1 de noviembre.
    expect(rangoDePeriodo("semana", "2026-10-31")).toEqual({ desde: "2026-10-26", hasta: "2026-11-01" });
    expect(rangoDePeriodo("semana", "2026-10-26")).toEqual({ desde: "2026-10-26", hasta: "2026-11-01" });
    expect(rangoDePeriodo("semana", "2026-11-01")).toEqual({ desde: "2026-10-26", hasta: "2026-11-01" });
  });

  it("la semana cruza el año", () => {
    // El 1 de enero de 2026 es jueves.
    expect(rangoDePeriodo("semana", "2026-01-01")).toEqual({ desde: "2025-12-29", hasta: "2026-01-04" });
  });

  it("el mes va del 1 al último día, con febrero bisiesto", () => {
    expect(rangoDePeriodo("mes", "2026-10-14")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(rangoDePeriodo("mes", "2026-02-10")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(rangoDePeriodo("mes", "2028-02-10")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
  });

  it("el año va del 1 de enero al 31 de diciembre", () => {
    expect(rangoDePeriodo("anio", "2026-10-14")).toEqual({ desde: "2026-01-01", hasta: "2026-12-31" });
  });

  it("un gasto del 31 de octubre cae en octubre y nunca en noviembre", () => {
    const octubre = rangoDePeriodo("mes", "2026-10-05");
    const noviembre = rangoDePeriodo("mes", "2026-11-05");
    const dentro = (f: string, r: { desde: string; hasta: string }) => f >= r.desde && f <= r.hasta;
    expect(dentro("2026-10-31", octubre)).toBe(true);
    expect(dentro("2026-10-31", noviembre)).toBe(false);
    expect(dentro("2026-11-01", octubre)).toBe(false);
  });
});

describe("moverPeriodo", () => {
  const lejos = "2030-12-31";

  it("mueve días y semanas cruzando meses y años", () => {
    expect(moverPeriodo("dia", "2026-03-01", -1, lejos)).toBe("2026-02-28");
    expect(moverPeriodo("dia", "2026-12-31", 1, lejos)).toBe("2027-01-01");
    expect(moverPeriodo("semana", "2026-10-31", 1, lejos)).toBe("2026-11-07");
    expect(moverPeriodo("semana", "2026-01-01", -1, lejos)).toBe("2025-12-25");
  });

  it("del 31 de enero, un mes adelante da febrero sin saltar a marzo", () => {
    expect(moverPeriodo("mes", "2026-01-31", 1, lejos)).toBe("2026-02-28");
    expect(moverPeriodo("mes", "2026-03-31", -1, lejos)).toBe("2026-02-28");
    expect(moverPeriodo("mes", "2028-01-31", 1, lejos)).toBe("2028-02-29");
    expect(moverPeriodo("mes", "2026-12-15", 1, lejos)).toBe("2027-01-15");
  });

  it("mueve años, con el 29 de febrero que no existe al año siguiente", () => {
    expect(moverPeriodo("anio", "2028-02-29", 1, lejos)).toBe("2029-02-28");
    expect(moverPeriodo("anio", "2026-10-14", -1, lejos)).toBe("2025-10-14");
  });

  it("nunca pasa de hoy: el día de referencia no puede ser futuro", () => {
    expect(moverPeriodo("mes", "2026-09-30", 1, hoy)).toBe(hoy);
    expect(moverPeriodo("semana", "2026-10-10", 1, hoy)).toBe(hoy);
    expect(moverPeriodo("dia", hoy, 1, hoy)).toBe(hoy);
  });
});

describe("esPeriodoActual", () => {
  it("dice si hoy está dentro del periodo, para apagar la flecha siguiente", () => {
    expect(esPeriodoActual("mes", "2026-10-01", hoy)).toBe(true);
    expect(esPeriodoActual("mes", "2026-09-30", hoy)).toBe(false);
    expect(esPeriodoActual("semana", "2026-10-12", hoy)).toBe(true);
    expect(esPeriodoActual("semana", "2026-10-11", hoy)).toBe(false);
    expect(esPeriodoActual("dia", hoy, hoy)).toBe(true);
    expect(esPeriodoActual("anio", "2026-01-01", hoy)).toBe(true);
    expect(esPeriodoActual("anio", "2025-12-31", hoy)).toBe(false);
  });
});

describe("etiquetaDia", () => {
  it("dice Hoy y Ayer, y si no el día con su nombre", () => {
    expect(etiquetaDia(hoy, hoy)).toBe("Hoy");
    expect(etiquetaDia("2026-10-13", hoy)).toBe("Ayer");
    expect(etiquetaDia("2026-10-12", hoy)).toBe("Lunes 12 de octubre");
  });

  it("agrega el año cuando no es el de hoy", () => {
    expect(etiquetaDia("2025-12-29", hoy)).toBe("Lunes 29 de diciembre de 2025");
  });
});

describe("etiquetaPeriodo", () => {
  it("nombra cada periodo", () => {
    expect(etiquetaPeriodo("dia", hoy, hoy)).toBe("Hoy");
    expect(etiquetaPeriodo("mes", "2026-10-03", hoy)).toBe("Octubre de 2026");
    expect(etiquetaPeriodo("anio", "2026-03-03", hoy)).toBe("2026");
  });

  it("la semana muestra sus dos extremos", () => {
    expect(etiquetaPeriodo("semana", "2026-10-14", hoy)).toBe("12 – 18 oct 2026");
    expect(etiquetaPeriodo("semana", "2026-10-31", hoy)).toBe("26 oct – 1 nov 2026");
    expect(etiquetaPeriodo("semana", "2026-01-01", hoy)).toBe("29 dic 2025 – 4 ene 2026");
  });
});

describe("leerFiltros", () => {
  it("sin parámetros: gastos del mes de hoy, sin categoría", () => {
    expect(leerFiltros({}, hoy)).toEqual({ pestana: "gastos", periodo: "mes", fecha: hoy, categoria: null });
  });

  it("lee parámetros válidos", () => {
    expect(leerFiltros({ tipo: "ingresos", periodo: "semana", fecha: "2026-09-02", categoria: "12" }, hoy)).toEqual({
      pestana: "ingresos",
      periodo: "semana",
      fecha: "2026-09-02",
      categoria: 12,
    });
  });

  it("cada parámetro inválido cae en su valor por defecto, sin romper", () => {
    const malos = [
      { tipo: "transferencias" },
      { tipo: ["gastos", "ingresos"] },
      { periodo: "trimestre" },
      { fecha: "2026-02-30" },
      { fecha: "2026-10-15" },
      { fecha: "'; drop table movimientos; --" },
      { categoria: "0" },
      { categoria: "-3" },
      { categoria: "3.5" },
      { categoria: "1e3" },
      { categoria: "99999999999" },
      { categoria: ["3", "4"] },
    ];
    for (const parametros of malos) {
      const leidos = leerFiltros(parametros, hoy);
      expect(leidos.pestana).toBe("gastos");
      expect(leidos.periodo).toBe("mes");
      expect(leidos.fecha).toBe(hoy);
      expect(leidos.categoria).toBeNull();
    }
  });

  it("en Mover no hay filtro de categoría", () => {
    expect(leerFiltros({ tipo: "mover", categoria: "3" }, hoy).categoria).toBeNull();
  });
});

describe("consultaDeFiltros", () => {
  it("omite lo que vale por defecto", () => {
    expect(consultaDeFiltros({ pestana: "gastos", periodo: "mes", fecha: hoy, categoria: null }, hoy)).toBe("");
  });

  it("ida y vuelta con leerFiltros", () => {
    const filtros = { pestana: "ingresos", periodo: "anio", fecha: "2025-06-01", categoria: 4 } as const;
    const consulta = consultaDeFiltros(filtros, hoy);
    expect(consulta).toBe("?tipo=ingresos&periodo=anio&fecha=2025-06-01&categoria=4");
    expect(leerFiltros(Object.fromEntries(new URLSearchParams(consulta)), hoy)).toEqual(filtros);
  });
});

describe("años de menos de cuatro cifras (revisión de la 003, hallazgo 5)", () => {
  it("el rango de un mes o un año lleva el año con sus cuatro cifras", () => {
    expect(rangoDePeriodo("mes", "0100-06-15")).toEqual({ desde: "0100-06-01", hasta: "0100-06-30" });
    expect(rangoDePeriodo("anio", "0999-03-01")).toEqual({ desde: "0999-01-01", hasta: "0999-12-31" });
  });

  it("moverse a otro mes o año también", () => {
    expect(moverPeriodo("anio", "0100-06-15", -1, hoy)).toBe("0099-06-15");
    expect(moverPeriodo("mes", "0999-12-15", 1, hoy)).toBe("1000-01-15");
    expect(moverPeriodo("mes", "0100-01-31", -1, hoy)).toBe("0099-12-31");
  });
});

describe("Todo: sin cortar por fecha", () => {
  it("el rango abarca cualquier fecha que guarde la base, sea cual sea el día de referencia", () => {
    expect(rangoDePeriodo("todo", "2026-10-14")).toEqual({ desde: "0001-01-01", hasta: "9999-12-31" });
    expect(rangoDePeriodo("todo", "2025-01-01")).toEqual(rangoDePeriodo("todo", "2026-10-14"));
  });

  it("no hay periodo anterior ni siguiente", () => {
    expect(moverPeriodo("todo", "2026-10-01", -1, hoy)).toBe("2026-10-01");
    expect(moverPeriodo("todo", "2026-10-01", 1, hoy)).toBe("2026-10-01");
    expect(esPeriodoActual("todo", "2025-01-01", hoy)).toBe(true);
  });

  it('se llama "Todo el historial"', () => {
    expect(etiquetaPeriodo("todo", "2026-10-14", hoy)).toBe("Todo el historial");
  });

  it("viaja en la dirección y se lee de vuelta", () => {
    const filtros = { pestana: "gastos", periodo: "todo", fecha: hoy, categoria: null } as const;
    expect(consultaDeFiltros(filtros, hoy)).toBe("?periodo=todo");
    expect(leerFiltros({ periodo: "todo" }, hoy)).toEqual(filtros);
  });
});
