/**
 * Criterios ★ 5 y 6 de la spec 003 (movimientos por categoría), escritos desde su texto: los bordes de cada periodo y
 * los parámetros manipulados de la dirección. Las pruebas de construcción viven en periodos.test.ts. Que la base
 * cuente por la columna fecha con esos bordes, que una categoría de otro tipo no filtre y que la página no falle con
 * cada parámetro inválido lo comprueba scripts/comprobar-003.ts (con --url, las páginas).
 */
import { describe, expect, it } from "vitest";
import { esFecha, hoyEnCaracas } from "./fechas";
import { type Filtros, type TipoPeriodo, leerFiltros, rangoDePeriodo } from "./periodos";

/** Días a mano con Date en UTC, para no depender de las funciones que se prueban. */
const diaSiguiente = (fecha: string) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const diaDeLaSemana = (fecha: string) =>
  ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][
    new Date(`${fecha}T00:00:00Z`).getUTCDay()
  ];
function dias(desde: string, hasta: string) {
  const lista: string[] = [];
  for (let d = desde; d <= hasta; d = diaSiguiente(d)) lista.push(d);
  return lista;
}
const contiene = ({ desde, hasta }: { desde: string; hasta: string }, fecha: string) =>
  fecha >= desde && fecha <= hasta;

describe("★ 5 · bordes del periodo", () => {
  it("Día: ese día", () => {
    for (const fecha of ["2026-10-16", "2024-02-29", "2026-01-01", "2025-12-31"]) {
      expect(rangoDePeriodo("dia", fecha)).toEqual({ desde: fecha, hasta: fecha });
    }
  });

  it("Semana: de lunes a domingo, desde cualquier día de esa semana", () => {
    for (const fecha of dias("2026-10-12", "2026-10-18")) {
      expect(rangoDePeriodo("semana", fecha)).toEqual({ desde: "2026-10-12", hasta: "2026-10-18" });
    }
    expect(diaDeLaSemana("2026-10-12")).toBe("lunes");
    expect(diaDeLaSemana("2026-10-18")).toBe("domingo");
  });

  it("Semana: el domingo cierra su semana, no abre la siguiente", () => {
    expect(rangoDePeriodo("semana", "2026-11-01")).toEqual({ desde: "2026-10-26", hasta: "2026-11-01" });
    expect(rangoDePeriodo("semana", "2026-11-02")).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
  });

  it("Semana: cruza el mes y el año", () => {
    for (const fecha of dias("2025-12-29", "2026-01-04")) {
      expect(rangoDePeriodo("semana", fecha)).toEqual({ desde: "2025-12-29", hasta: "2026-01-04" });
    }
  });

  it("Mes: del 1 al último día, cada mes de 2026", () => {
    const ultimos = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    ultimos.forEach((ultimo, i) => {
      const mes = String(i + 1).padStart(2, "0");
      for (const dia of ["01", "15", String(ultimo)]) {
        expect(rangoDePeriodo("mes", `2026-${mes}-${dia}`)).toEqual({
          desde: `2026-${mes}-01`,
          hasta: `2026-${mes}-${ultimo}`,
        });
      }
    });
  });

  it("Mes: febrero de un año bisiesto llega al 29, y el de uno que no lo es al 28", () => {
    expect(rangoDePeriodo("mes", "2024-02-10")).toEqual({ desde: "2024-02-01", hasta: "2024-02-29" });
    expect(rangoDePeriodo("mes", "2000-02-10")).toEqual({ desde: "2000-02-01", hasta: "2000-02-29" });
    expect(rangoDePeriodo("mes", "2100-02-10")).toEqual({ desde: "2100-02-01", hasta: "2100-02-28" });
    expect(rangoDePeriodo("mes", "2025-02-10")).toEqual({ desde: "2025-02-01", hasta: "2025-02-28" });
  });

  it("Año: del 1 de enero al 31 de diciembre", () => {
    for (const fecha of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      expect(rangoDePeriodo("anio", fecha)).toEqual({ desde: "2026-01-01", hasta: "2026-12-31" });
    }
  });

  it("el ejemplo: un gasto del 31 de octubre de 2026 entra en octubre y en la semana del 26 de octubre al 1 de noviembre", () => {
    expect(rangoDePeriodo("mes", "2026-10-31")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(rangoDePeriodo("semana", "2026-10-31")).toEqual({ desde: "2026-10-26", hasta: "2026-11-01" });
    for (const fecha of dias("2026-10-01", "2026-10-31")) {
      expect(contiene(rangoDePeriodo("mes", fecha), "2026-10-31")).toBe(true);
    }
    for (const fecha of dias("2026-10-26", "2026-11-01")) {
      expect(contiene(rangoDePeriodo("semana", fecha), "2026-10-31")).toBe(true);
    }
  });

  it("y nunca en noviembre, se mire desde el día de noviembre que se mire", () => {
    for (const fecha of dias("2026-11-01", "2026-11-30")) {
      expect(contiene(rangoDePeriodo("mes", fecha), "2026-10-31")).toBe(false);
    }
  });

  it("cada día cae en un solo periodo de cada tipo, sin huecos ni solapes, de 2023 a 2027", () => {
    const inicios: Record<TipoPeriodo, (desde: string) => boolean> = {
      dia: () => true,
      semana: (desde) => diaDeLaSemana(desde) === "lunes",
      mes: (desde) => desde.endsWith("-01"),
      anio: (desde) => desde.endsWith("-01-01"),
      todo: (desde) => desde === "0001-01-01",
    };
    const finales: Record<TipoPeriodo, (hasta: string) => boolean> = {
      dia: () => true,
      semana: (hasta) => diaDeLaSemana(hasta) === "domingo",
      mes: (hasta) => diaSiguiente(hasta).endsWith("-01"),
      anio: (hasta) => hasta.endsWith("-12-31"),
      todo: (hasta) => hasta === "9999-12-31",
    };
    for (const tipo of ["dia", "semana", "mes", "anio", "todo"] as const) {
      let anterior: { desde: string; hasta: string } | null = null;
      for (const fecha of dias("2023-01-01", "2027-12-31")) {
        const rango = rangoDePeriodo(tipo, fecha);
        expect(contiene(rango, fecha)).toBe(true);
        if (anterior && rango.desde !== anterior.desde) {
          // Un periodo nuevo empieza justo el día después de que terminó el anterior, y en este día.
          expect(rango.desde).toBe(diaSiguiente(anterior.hasta));
          expect(rango.desde).toBe(fecha);
        } else if (anterior) {
          expect(rango).toEqual(anterior);
        }
        expect(inicios[tipo](rango.desde)).toBe(true);
        expect(finales[tipo](rango.hasta)).toBe(true);
        anterior = rango;
      }
    }
  });
});

describe("★ 6 · parámetros manipulados", () => {
  const hoy = "2026-10-16";
  const porDefecto: Filtros = { pestana: "gastos", periodo: "mes", fecha: hoy, categoria: null };

  it("sin parámetros: Gastos del mes actual sin filtro", () => {
    expect(leerFiltros({}, hoy)).toEqual(porDefecto);
  });

  it("todos inválidos a la vez: Gastos del mes actual sin filtro", () => {
    expect(leerFiltros({ tipo: "x", periodo: "siglo", fecha: "2026-02-30", categoria: "-1" }, hoy)).toEqual(porDefecto);
  });

  it("un ?tipo= inválido cae en Gastos", () => {
    const malos = ["", "x", "GASTOS", "Gastos", "gasto", "ingreso", "gastos ", "1", "<script>", "gastos' or '1'='1"];
    for (const tipo of [...malos, ["gastos", "ingresos"]]) {
      expect(leerFiltros({ tipo }, hoy)).toEqual(porDefecto);
    }
  });

  it("un ?periodo= inválido cae en el mes", () => {
    for (const periodo of ["", "siglo", "Mes", "MES", "semanal", "periodo", "rango", "año", ["dia", "mes"]]) {
      expect(leerFiltros({ periodo }, hoy)).toEqual(porDefecto);
    }
  });

  it("una ?fecha= que no es AAAA-MM-DD real cae en hoy", () => {
    const malas = [
      "",
      "hoy",
      "2026-02-30",
      "2025-02-29",
      "2026-13-01",
      "2026-00-10",
      "2026-10-32",
      "2026-10-00",
      "26-10-01",
      "2026-1-05",
      "2026/10/05",
      "05-10-2026",
      "2026-10-05T00:00",
      " 2026-10-05",
      "2026-10-05 ",
      "20261005",
      "2026-10-05' or '1'='1",
    ];
    for (const fecha of [...malas, ["2026-10-01", "2026-10-02"]]) {
      expect(leerFiltros({ fecha }, hoy)).toEqual(porDefecto);
    }
  });

  it("una ?fecha= futura cae en hoy", () => {
    for (const fecha of ["2026-10-17", "2026-11-01", "2027-01-01", "9999-12-31"]) {
      expect(leerFiltros({ fecha }, hoy)).toEqual(porDefecto);
    }
  });

  it('"no futura" es con el día de Caracas: a las 22:00 del 16 allí (02:00 UTC del 17), el 17 todavía es futuro', () => {
    const hoyAlli = hoyEnCaracas(new Date("2026-10-17T02:00:00Z"));
    expect(hoyAlli).toBe("2026-10-16");
    expect(leerFiltros({ fecha: "2026-10-17" }, hoyAlli).fecha).toBe("2026-10-16");
  });

  it("una ?fecha= real y no futura se conserva, también hoy y un 29 de febrero que existió", () => {
    for (const fecha of [hoy, "2026-10-15", "2024-02-29", "2025-12-31", "2000-01-01"]) {
      expect(leerFiltros({ fecha }, hoy)).toEqual({ ...porDefecto, fecha });
    }
  });

  it("una ?categoria= que no es un entero positivo cae en sin filtro", () => {
    const malas = ["", "0", "-1", "-0", "1.5", "1,5", "1e3", "abc", " 3", "3 ", "+3", "0x10", "3abc", "٣", "NaN"];
    for (const categoria of [...malas, "Infinity", ["3", "4"]]) {
      expect(leerFiltros({ categoria }, hoy)).toEqual(porDefecto);
    }
  });

  it("una ?categoria= que no cabe en un id de la base no llega a la consulta", () => {
    for (const categoria of ["2147483648", "99999999999", "9".repeat(400)]) {
      expect(leerFiltros({ categoria }, hoy).categoria).toBeNull();
    }
  });

  it("una ?categoria= entera positiva filtra en Gastos y en Ingresos", () => {
    expect(leerFiltros({ categoria: "7" }, hoy)).toEqual({ ...porDefecto, categoria: 7 });
    expect(leerFiltros({ tipo: "ingresos", categoria: "12" }, hoy)).toEqual({
      ...porDefecto,
      pestana: "ingresos",
      categoria: 12,
    });
  });

  it("Mover no tiene categorías: ninguna ?categoria= es de su tipo", () => {
    expect(leerFiltros({ tipo: "mover", categoria: "7" }, hoy)).toEqual({ ...porDefecto, pestana: "mover" });
  });

  it("los parámetros válidos se leen tal cual", () => {
    expect(leerFiltros({ tipo: "ingresos", periodo: "semana", fecha: "2026-09-30", categoria: "7" }, hoy)).toEqual({
      pestana: "ingresos",
      periodo: "semana",
      fecha: "2026-09-30",
      categoria: 7,
    });
    for (const periodo of ["dia", "semana", "mes", "anio"] as const) {
      expect(leerFiltros({ periodo }, hoy).periodo).toBe(periodo);
    }
  });

  it("uno inválido cae en su valor por defecto sin arrastrar a los válidos", () => {
    expect(leerFiltros({ tipo: "ingresos", periodo: "semana", fecha: "2026-02-30" }, hoy)).toEqual({
      ...porDefecto,
      pestana: "ingresos",
      periodo: "semana",
    });
    expect(leerFiltros({ tipo: "x", fecha: "2026-09-30" }, hoy)).toEqual({ ...porDefecto, fecha: "2026-09-30" });
  });

  it("con cualquier basura nunca lanza, y lo que sale ya es válido para la consulta", () => {
    let s = 3;
    const tirar = (tope: number) => (s = (s * 48_271) % 2_147_483_647) % tope;
    const piezas = ["", "-", "0", "1", "9", "2026", "-10-", "16", "31", "02-29", "dia", "mes", "x", " ", "'", "%", "٣"];
    const basura = () => Array.from({ length: tirar(6) }, () => piezas[tirar(piezas.length)]).join("");
    const valor = () => [undefined, basura(), [basura(), basura()]][tirar(3)];
    for (let vuelta = 0; vuelta < 3_000; vuelta++) {
      const filtros = leerFiltros({ tipo: valor(), periodo: valor(), fecha: valor(), categoria: valor() }, hoy);
      expect(["gastos", "ingresos", "mover"]).toContain(filtros.pestana);
      expect(["dia", "semana", "mes", "anio"]).toContain(filtros.periodo);
      expect(esFecha(filtros.fecha) && filtros.fecha <= hoy).toBe(true);
      if (filtros.categoria !== null) {
        expect(Number.isSafeInteger(filtros.categoria)).toBe(true);
        expect(filtros.categoria).toBeGreaterThan(0);
        expect(filtros.categoria).toBeLessThanOrEqual(2_147_483_647);
      }
      const { desde, hasta } = rangoDePeriodo(filtros.periodo, filtros.fecha);
      expect(esFecha(desde) && esFecha(hasta) && desde <= hasta).toBe(true);
    }
  });
});
