// Pure stock rules shared by server actions and screens. No I/O here, so they are easy to test.
import type { Ingredient, Movement, MovementLine, Product } from "../types";

export type StockLine = { id: string; qty: number };

export const MAX_LINES = 200;
export const MAX_QTY = 100_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalizes lines sent from the browser before they reach the database:
 * drops malformed ids and non-positive amounts, and merges duplicates.
 */
export function sanitizeLines(input: unknown): StockLine[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<string, number>();
  for (const raw of input) {
    const id = String((raw as StockLine)?.id ?? "");
    const qty = Number((raw as StockLine)?.qty);
    if (!UUID_RE.test(id) || !Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) continue;
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  return [...merged].slice(0, MAX_LINES).map(([id, qty]) => ({ id, qty }));
}

export type StockLevel = "ok" | "low" | "out";

/** Where an item stands against its minimum. */
export function stockLevel(stock: number, min: number): StockLevel {
  if (stock <= 0) return "out";
  return stock < min ? "low" : "ok";
}

export type DaySummary = {
  revenue: number;
  waste: number;
  unitsSold: number;
  topSellers: { productId: string; qty: number }[];
  lowIngredients: Ingredient[];
  lowProducts: Product[];
};

/**
 * Builds the owner's "today" view from the day's sale/waste movements, their lines and the catalog.
 * Sale lines are stored as negative quantities (stock out), so they are flipped here.
 */
export function summarizeDay(input: {
  movements: Pick<Movement, "id" | "kind" | "total">[];
  saleLines: Pick<MovementLine, "movement_id" | "product_id" | "qty">[];
  products: Product[];
  ingredients: Ingredient[];
  topN?: number;
}): DaySummary {
  const { movements, saleLines, products, ingredients, topN = 5 } = input;
  const sum = (kind: Movement["kind"]) =>
    movements.filter((m) => m.kind === kind).reduce((a, m) => a + Number(m.total), 0);

  const saleIds = new Set(movements.filter((m) => m.kind === "sale").map((m) => m.id));
  const byProduct = new Map<string, number>();
  for (const l of saleLines) {
    if (!l.product_id || !saleIds.has(l.movement_id)) continue;
    byProduct.set(l.product_id, (byProduct.get(l.product_id) ?? 0) - Number(l.qty));
  }

  return {
    revenue: sum("sale"),
    waste: sum("waste"),
    unitsSold: [...byProduct.values()].reduce((a, b) => a + b, 0),
    topSellers: [...byProduct]
      .map(([productId, qty]) => ({ productId, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, topN),
    lowIngredients: ingredients.filter((g) => g.active && stockLevel(Number(g.stock), Number(g.min_stock)) !== "ok"),
    lowProducts: products.filter((p) => p.active && stockLevel(Number(p.stock), Number(p.min_stock)) !== "ok"),
  };
}
