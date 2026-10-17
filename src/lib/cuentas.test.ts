import { describe, expect, it } from "vitest";
import { aspectoDeCuenta } from "./cuentas";

describe("aspectoDeCuenta: el icono y el color de una cuenta salen de su tipo y su moneda", () => {
  it("un aspecto por tipo: exchange, billetera, efectivo, la cuenta de la prima y bolívares", () => {
    expect(aspectoDeCuenta({ tipo: "exchange", moneda: "USDT" })).toBe("cripto");
    expect(aspectoDeCuenta({ tipo: "billetera", moneda: "USDC" })).toBe("billetera");
    expect(aspectoDeCuenta({ tipo: "efectivo", moneda: "USD" })).toBe("efectivo");
    expect(aspectoDeCuenta({ tipo: "transito", moneda: "USD" })).toBe("exterior");
    expect(aspectoDeCuenta({ tipo: "banco", moneda: "VES" })).toBe("bolivares");
  });

  it("los bolívares mandan sobre el tipo: cualquier cuenta en VES es de bolívares", () => {
    expect(aspectoDeCuenta({ tipo: "efectivo", moneda: "VES" })).toBe("bolivares");
    expect(aspectoDeCuenta({ tipo: "billetera", moneda: "VES" })).toBe("bolivares");
  });

  it("un banco en dólares es un banco, y un tipo desconocido también", () => {
    expect(aspectoDeCuenta({ tipo: "banco", moneda: "USD" })).toBe("banco");
    expect(aspectoDeCuenta({ tipo: "otro", moneda: "USD" })).toBe("banco");
  });
});
