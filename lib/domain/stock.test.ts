import { describe, expect, it } from "vitest";
import { MAX_QTY, sanitizeLines, stockLevel, summarizeDay } from "./stock";
import { startOfTodayTR } from "../types";
import type { Ingredient, Product } from "../types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("sanitizeLines", () => {
  it("keeps valid lines and merges duplicates", () => {
    expect(sanitizeLines([{ id: A, qty: 1 }, { id: A, qty: 2 }, { id: B, qty: 0.5 }])).toEqual([
      { id: A, qty: 3 },
      { id: B, qty: 0.5 },
    ]);
  });
  it("drops malformed ids, non-positive and oversized amounts", () => {
    expect(sanitizeLines([{ id: "x", qty: 1 }, { id: A, qty: 0 }, { id: A, qty: -2 }, { id: B, qty: MAX_QTY + 1 }, { id: B, qty: Number.NaN }])).toEqual([]);
  });
  it("returns nothing for non-array input", () => {
    expect(sanitizeLines(null)).toEqual([]);
    expect(sanitizeLines({ id: A, qty: 1 })).toEqual([]);
  });
});

describe("stockLevel", () => {
  it("classifies against the minimum", () => {
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(3, 5)).toBe("low");
    expect(stockLevel(5, 5)).toBe("ok");
  });
});

describe("summarizeDay", () => {
  const product = (id: string, stock: number, min: number): Product => ({
    id, business_id: "b", name: id, emoji: null, unit: "adet", price: 10, stock, min_stock: min, barcode: null, active: true, sort: 0,
  });
  const ingredient = (id: string, stock: number, min: number, active = true): Ingredient => ({
    id, business_id: "b", name: id, unit: "kg", stock, min_stock: min, active,
  });

  it("adds up revenue, waste and units sold, ranking top sellers", () => {
    const day = summarizeDay({
      movements: [
        { id: "m1", kind: "sale", total: 50 },
        { id: "m2", kind: "sale", total: 30 },
        { id: "m3", kind: "waste", total: 20 },
      ],
      saleLines: [
        { movement_id: "m1", product_id: A, qty: -2 },
        { movement_id: "m2", product_id: B, qty: -3 },
        { movement_id: "m3", product_id: A, qty: -2 }, // waste line: not a sale
      ],
      products: [product(A, 10, 1), product(B, 0, 2)],
      ingredients: [ingredient("un", 1, 2), ingredient("eski", 0, 5, false), ingredient("seker", 9, 2)],
    });
    expect(day.revenue).toBe(80);
    expect(day.waste).toBe(20);
    expect(day.unitsSold).toBe(5);
    expect(day.topSellers).toEqual([{ productId: B, qty: 3 }, { productId: A, qty: 2 }]);
    expect(day.lowProducts.map((p) => p.id)).toEqual([B]);
    expect(day.lowIngredients.map((g) => g.id)).toEqual(["un"]); // inactive ones are ignored
  });
});

describe("startOfTodayTR", () => {
  it("starts the day at 00:00 Türkiye time (21:00 UTC the day before)", () => {
    expect(startOfTodayTR(new Date("2026-11-08T10:00:00Z"))).toBe("2026-11-07T21:00:00.000Z");
    expect(startOfTodayTR(new Date("2026-11-08T22:30:00Z"))).toBe("2026-11-08T21:00:00.000Z");
  });
});
