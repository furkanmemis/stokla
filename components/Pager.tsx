"use client";

import Link from "next/link";
import type { Page } from "@/lib/domain/paging";

const label = (page: Page) => <span className="lead" aria-current="page">Sayfa {page.page} / {page.pageCount}</span>;
const off = (text: string) => <span className="btn small secondary" aria-disabled="true">{text}</span>;

/**
 * Previous / next links for server-rendered lists. Keeps the other query parameters (filters, other
 * lists' pages); `param` names this list's page in the URL, `hash` brings the reader back to the list.
 */
export function Pager({ page, basePath, params = {}, param = "page", hash }: {
  page: Page; basePath: string; params?: Record<string, string | undefined>; param?: string; hash?: string;
}) {
  if (page.pageCount <= 1) return null;
  const href = (n: number) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1] && e[0] !== param));
    if (n > 1) q.set(param, String(n));
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
  };
  return (
    <nav className="pager" aria-label="Sayfalar">
      {page.hasPrev ? <Link className="btn small secondary" href={href(page.page - 1)} rel="prev" scroll={!hash}>Önceki</Link> : off("Önceki")}
      {label(page)}
      {page.hasNext ? <Link className="btn small secondary" href={href(page.page + 1)} rel="next" scroll={!hash}>Sonraki</Link> : off("Sonraki")}
    </nav>
  );
}

/** Previous / next buttons for lists paged in the browser (forms keep what was typed on other pages). */
export function ClientPager({ page, onPage }: { page: Page; onPage: (n: number) => void }) {
  if (page.pageCount <= 1) return null;
  return (
    <nav className="pager" aria-label="Sayfalar">
      {page.hasPrev ? <button type="button" className="btn small secondary" onClick={() => onPage(page.page - 1)}>Önceki</button> : off("Önceki")}
      {label(page)}
      {page.hasNext ? <button type="button" className="btn small secondary" onClick={() => onPage(page.page + 1)}>Sonraki</button> : off("Sonraki")}
    </nav>
  );
}
