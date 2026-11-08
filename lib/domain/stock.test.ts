import { describe, expect, it } from "vitest";
import { MAX_QTY, OTHER_CATEGORY, attachStock, categoriesOf, gaugePercent, lowStock, salesByPlace, sanitizeLines, sanitizeProductionLines, stockLevel, summarizeDay, type LowRow } from "./stock";

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

describe("attachStock", () => {
  it("joins stock rows and treats missing rows as zero", () => {
    expect(attachStock([{ id: "a" }, { id: "b" }], [{ id: "a", qty: 3 }])).toEqual([{ id: "a", stock: 3 }, { id: "b", stock: 0 }]);
  });
});

describe("lowStock", () => {
  const row = (placeName: string, id: string, qty: number, min: number): LowRow =>
    ({ placeId: placeName, placeName, kind: "product", id, name: id, unit: "adet", qty, min });
  it("keeps items under their minimum at each place, emptiest first", () => {
    const rows = [row("AVM", "sutlac", 1, 4), row("Merkez", "sutlac", 9, 4), row("Sahil", "sutlac", 0, 4), row("AVM", "x", 0, 0)];
    expect(lowStock(rows).map((r) => r.placeName)).toEqual(["Sahil", "AVM"]);
  });
});

describe("salesByPlace", () => {
  it("adds up sales per place, largest first", () => {
    expect(salesByPlace([
      { kind: "sale", total: 50, location_id: "a" }, { kind: "sale", total: 80, location_id: "b" },
      { kind: "sale", total: 40, location_id: "a" }, { kind: "waste", total: 99, location_id: "a" },
      { kind: "sale", total: 10, location_id: null },
    ])).toEqual([{ placeId: "a", revenue: 90 }, { placeId: "b", revenue: 80 }]);
  });
});

describe("summarizeDay", () => {
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
    });
    expect(day.revenue).toBe(80);
    expect(day.waste).toBe(20);
    expect(day.unitsSold).toBe(5);
    expect(day.unitsMade).toBe(40);
    expect(day.hourly.find((h) => h.hour === 9)?.revenue).toBe(80);
    expect(day.hourly[0].hour).toBe(7);
    expect(day.hourly.at(-1)?.hour).toBe(21);
    expect(day.topSellers).toEqual([{ productId: B, qty: 3 }, { productId: A, qty: 2 }]);
  });

  it("widens the hour range when sales happen outside opening hours", () => {
    const day = summarizeDay({
      movements: [{ id: "m", kind: "sale", total: 5, created_at: "2026-11-08T20:30:00Z" }], // 23:30 TR
      lines: [],
    });
    expect(day.hourly.at(-1)).toEqual({ hour: 23, revenue: 5 });
  });
});
