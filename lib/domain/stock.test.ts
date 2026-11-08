import { describe, expect, it } from "vitest";
import { MAX_QTY, OTHER_CATEGORY, categoriesOf, gaugePercent, sanitizeLines, sanitizeProductionLines, stockLevel, summarizeDay } from "./stock";
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

describe("sanitizeProductionLines", () => {
  it("keeps valid expiry dates and weights, nulls the rest", () => {
    expect(sanitizeProductionLines([
      { id: A, qty: 40, expires_on: "2026-11-10", weight_g: 80 },
      { id: B, qty: 2, expires_on: "10.11.2026", weight_g: 0 },
      { id: "nope", qty: 1 },
    ])).toEqual([
      { id: A, qty: 40, expires_on: "2026-11-10", weight_g: 80 },
      { id: B, qty: 2, expires_on: null, weight_g: null },
    ]);
  });
  it("rounds weights to whole grams", () => {
    expect(sanitizeProductionLines([{ id: A, qty: 1, weight_g: 79.6 }])[0].weight_g).toBe(80);
  });
});

describe("categoriesOf", () => {
  it("keeps first-seen order and puts uncategorized last", () => {
    expect(categoriesOf([{ category: "Kahve" }, { category: null }, { category: "Tatlı" }, { category: "Kahve" }])).toEqual(["Kahve", "Tatlı", OTHER_CATEGORY]);
  });
  it("needs no filter when nothing is categorized", () => {
    expect(categoriesOf([{ category: null }])).toEqual([]);
  });
});

describe("stockLevel and gaugePercent", () => {
  it("classifies against the minimum", () => {
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(3, 5)).toBe("low");
    expect(stockLevel(5, 5)).toBe("ok");
  });
  it("puts the minimum at one third of the gauge and clamps", () => {
    expect(gaugePercent(5, 5)).toBe(33);
    expect(gaugePercent(100, 5)).toBe(100);
    expect(gaugePercent(-1, 5)).toBe(0);
  });
});

describe("summarizeDay", () => {
  const product = (id: string, stock: number, min: number): Product => ({
    id, business_id: "b", name: id, emoji: null, unit: "adet", price: 10, stock, min_stock: min,
    barcode: null, active: true, sort: 0, weight_g: null, category: null, made_to_order: false,
  });
  const ingredient = (id: string, stock: number, min: number, active = true): Ingredient => ({
    id, business_id: "b", name: id, unit: "kg", stock, min_stock: min, active,
  });

  it("adds up revenue, waste, units and hourly sales, ranking top sellers", () => {
    const day = summarizeDay({
      movements: [
        { id: "m1", kind: "sale", total: 50, created_at: "2026-11-08T06:15:00Z" }, // 09:15 TR
        { id: "m2", kind: "sale", total: 30, created_at: "2026-11-08T06:45:00Z" }, // 09:45 TR
        { id: "m3", kind: "waste", total: 20, created_at: "2026-11-08T10:00:00Z" },
        { id: "m4", kind: "production", total: 0, created_at: "2026-11-08T04:00:00Z" },
      ],
      lines: [
        { movement_id: "m1", product_id: A, qty: -2 },
        { movement_id: "m2", product_id: B, qty: -3 },
        { movement_id: "m3", product_id: A, qty: -2 }, // waste: not a sale
        { movement_id: "m4", product_id: A, qty: 40 },
      ],
      products: [product(A, 10, 1), product(B, 0, 2), { ...product("coffee", 0, 5), made_to_order: true }],
      ingredients: [ingredient("un", 1, 2), ingredient("eski", 0, 5, false), ingredient("seker", 9, 2)],
    });
    expect(day.revenue).toBe(80);
    expect(day.waste).toBe(20);
    expect(day.unitsSold).toBe(5);
    expect(day.unitsMade).toBe(40);
    expect(day.hourly.find((h) => h.hour === 9)?.revenue).toBe(80);
    expect(day.hourly[0].hour).toBe(7);
    expect(day.hourly.at(-1)?.hour).toBe(21);
    expect(day.topSellers).toEqual([{ productId: B, qty: 3 }, { productId: A, qty: 2 }]);
    expect(day.lowProducts.map((p) => p.id)).toEqual([B]);
    expect(day.lowIngredients.map((g) => g.id)).toEqual(["un"]); // inactive ones are ignored
  });

  it("widens the hour range when sales happen outside opening hours", () => {
    const day = summarizeDay({
      movements: [{ id: "m", kind: "sale", total: 5, created_at: "2026-11-08T20:30:00Z" }], // 23:30 TR
      lines: [], products: [], ingredients: [],
    });
    expect(day.hourly.at(-1)).toEqual({ hour: 23, revenue: 5 });
  });
});
