// Page math for long lists. Pure, so the movements screen and tests share one rule.

export type Page = { page: number; pageCount: number; from: number; to: number; hasPrev: boolean; hasNext: boolean };

/**
 * Clamps a requested page (1-based, from the URL) to what exists and returns the row range for it.
 * `from`/`to` are inclusive 0-based offsets, the shape Supabase's range() expects.
 */
export function pageOf(requested: unknown, total: number, size: number): Page {
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const n = Math.floor(Number(requested));
  const page = Number.isFinite(n) ? Math.min(Math.max(1, n), pageCount) : 1;
  const from = (page - 1) * size;
  return { page, pageCount, from, to: from + size - 1, hasPrev: page > 1, hasNext: page < pageCount };
}

/** One page of an already-loaded list, with the page info for a pager. */
export function slicePage<T>(items: T[], requested: unknown, size: number): { items: T[]; page: Page } {
  const page = pageOf(requested, items.length, size);
  return { items: items.slice(page.from, page.to + 1), page };
}
