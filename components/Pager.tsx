import Link from "next/link";
import type { Page } from "@/lib/domain/paging";

/** Previous / next links that keep the other query parameters (e.g. a filter). */
export function Pager({ page, basePath, params = {} }: { page: Page; basePath: string; params?: Record<string, string | undefined> }) {
  if (page.pageCount <= 1) return null;
  const href = (n: number) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="pager" aria-label="Sayfalar">
      {page.hasPrev ? <Link className="btn small secondary" href={href(page.page - 1)} rel="prev">Önceki</Link> : <span className="btn small secondary" aria-disabled="true">Önceki</span>}
      <span className="lead" aria-current="page">Sayfa {page.page} / {page.pageCount}</span>
      {page.hasNext ? <Link className="btn small secondary" href={href(page.page + 1)} rel="next">Sonraki</Link> : <span className="btn small secondary" aria-disabled="true">Sonraki</span>}
    </nav>
  );
}
