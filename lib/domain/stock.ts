// Pure stock rules shared by server actions and screens. No I/O here, so they are easy to test.
import type { Ingredient, Movement, MovementLine, Product } from "../types";
import { hourTR, isIsoDay } from "./dates";

export type StockLine = { id: string; qty: number };
export type ProductionLine = StockLine & { expires_on?: string | null; weight_g?: number | null };

export const MAX_LINES = 200;
export const MAX_QTY = 100_000;
export const MAX_WEIGHT_G = 100_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validId = (id: unknown): id is string => typeof id === "string" && UUID_RE.test(id);
const validQty = (q: number) => Number.isFinite(q) && q > 0 && q <= MAX_QTY;

/**
 * Normalizes sale lines sent from the browser before they reach the database:
 * drops malformed ids and non-positive amounts, and merges duplicates.
 */
export function sanitizeLines(input: unknown): StockLine[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<string, number>();
  for (const raw of input) {
    const id = (raw as StockLine)?.id;
    const qty = Number((raw as StockLine)?.qty);
    if (!validId(id) || !validQty(qty)) continue;
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  return [...merged].slice(0, MAX_LINES).map(([id, qty]) => ({ id, qty }));
}

/** Like sanitizeLines, keeping each batch's optional expiry date and unit weight (grams). */
export function sanitizeProductionLines(input: unknown): ProductionLine[] {
  if (!Array.isArray(input)) return [];
  const out: ProductionLine[] = [];
  for (const raw of input.slice(0, MAX_LINES)) {
    const r = raw as ProductionLine;
    const qty = Number(r?.qty);
    if (!validId(r?.id) || !validQty(qty)) continue;
    const weight = Math.round(Number(r.weight_g));
    out.push({
      id: r.id,
      qty,
      expires_on: isIsoDay(r.expires_on) ? r.expires_on : null,
      weight_g: weight >= 1 && weight <= MAX_WEIGHT_G ? weight : null,
    });
  }
  return out;
}

export type StockLevel = "ok" | "low" | "out";

/** Menu sections in first-seen order, for the category filter. Products without one come last as "Diğer". */
export function categoriesOf(products: { category: string | null }[]): string[] {
  const seen: string[] = [];
  let other = false;
  for (const p of products) {
    if (!p.category) other = true;
    else if (!seen.includes(p.category)) seen.push(p.category);
  }
  return other && seen.length ? [...seen, OTHER_CATEGORY] : seen;
}
export const OTHER_CATEGORY = "Diğer";

/** Where an item stands against its minimum. */
export function stockLevel(stock: number, min: number): StockLevel {
  if (stock <= 0) return "out";
  return stock < min ? "low" : "ok";
}

/** How full a gauge is: the minimum sits at one third of the bar. Returns 0–100. */
export function gaugePercent(stock: number, min: number): number {
  const full = Math.max(min * 3, 0.001);
  return Math.max(0, Math.min(100, Math.round((stock / full) * 100)));
}

export type DaySummary = {
  revenue: number;
  waste: number;
  unitsSold: number;
  unitsMade: number;
  hourly: { hour: number; revenue: number }[];
  topSellers: { productId: string; qty: number }[];
  lowIngredients: Ingredient[];
  lowProducts: Product[];
};

export const OPENING_HOURS = { from: 7, to: 21 } as const;

/**
 * Builds the admin's "today" view from the day's movements, their product lines and the catalog.
 * Sale lines are stored as negative quantities (stock out), so they are flipped here.
 */
export function summarizeDay(input: {
  movements: Pick<Movement, "id" | "kind" | "total" | "created_at">[];
  lines: Pick<MovementLine, "movement_id" | "product_id" | "qty">[];
  products: Product[];
  ingredients: Ingredient[];
  topN?: number;
  hours?: { from: number; to: number };
}): DaySummary {
  const { movements, lines, products, ingredients, topN = 5, hours = OPENING_HOURS } = input;
  const kindOf = new Map(movements.map((m) => [m.id, m.kind]));
  const sum = (kind: Movement["kind"]) => movements.filter((m) => m.kind === kind).reduce((a, m) => a + Number(m.total), 0);

  const sold = new Map<string, number>();
  let unitsMade = 0;
  for (const l of lines) {
    if (!l.product_id) continue;
    const kind = kindOf.get(l.movement_id);
    if (kind === "sale") sold.set(l.product_id, (sold.get(l.product_id) ?? 0) - Number(l.qty));
    else if (kind === "production") unitsMade += Number(l.qty);
  }

  const byHour = new Map<number, number>();
  for (const m of movements) {
    if (m.kind !== "sale") continue;
    const h = hourTR(m.created_at);
    byHour.set(h, (byHour.get(h) ?? 0) + Number(m.total));
  }
  const from = Math.min(hours.from, ...byHour.keys());
  const to = Math.max(hours.to, ...byHour.keys());
  const hourly = Array.from({ length: to - from + 1 }, (_, i) => ({ hour: from + i, revenue: byHour.get(from + i) ?? 0 }));

  return {
    revenue: sum("sale"),
    waste: sum("waste"),
    unitsSold: [...sold.values()].reduce((a, b) => a + b, 0),
    unitsMade,
    hourly,
    topSellers: [...sold]
      .map(([productId, qty]) => ({ productId, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, topN),
    lowIngredients: ingredients
      .filter((g) => g.active && stockLevel(Number(g.stock), Number(g.min_stock)) !== "ok")
      .sort((a, b) => Number(a.stock) / (Number(a.min_stock) || 1) - Number(b.stock) / (Number(b.min_stock) || 1)),
    lowProducts: products.filter((p) => p.active && !p.made_to_order && stockLevel(Number(p.stock), Number(p.min_stock)) !== "ok"),
  };
}
