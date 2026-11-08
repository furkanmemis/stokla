// Rules for the shared pool: production fills it, selling places take products from it onto their shelf.
import { sanitizeLines, type StockLine } from "./stock";

/**
 * Cleans the lines of a "take from the pool" and checks them against what the pool holds.
 * The database checks again under a lock; this gives a clear message first.
 */
export function checkTake(input: unknown, available: Record<string, number>, names: Record<string, string> = {}):
  { ok: true; lines: StockLine[] } | { ok: false; error: string } {
  const lines = sanitizeLines(input);
  if (!lines.length) return { ok: false, error: "Havuzdan alınacak ürün seçmedin." };
  const short = lines.find((l) => l.qty > (available[l.id] ?? 0));
  if (short) {
    const name = names[short.id] ?? "Ürün";
    return { ok: false, error: `Havuzda ${name} için ${available[short.id] ?? 0} var, ${short.qty} alınamaz.` };
  }
  return { ok: true, lines };
}

/** Total units across lines, for a button or summary. */
export const totalUnits = (lines: { qty: number }[]) => lines.reduce((a, l) => a + Number(l.qty), 0);
