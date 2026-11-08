import type { Metadata } from "next";
import Link from "next/link";
import { param, type SearchParams } from "@/components/Alert";
import { Pager } from "@/components/Pager";
import { requireMember } from "@/lib/session";
import { shortDay } from "@/lib/domain/dates";
import { pageOf } from "@/lib/domain/paging";
import { KIND_LABEL, num, tl, type Ingredient, type Movement, type MovementKind, type MovementLine, type Product } from "@/lib/types";

export const metadata: Metadata = { title: "Hareketler" };

const PAGE_SIZE = 25;
const KINDS = Object.keys(KIND_LABEL) as MovementKind[];

const time = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Row = Movement & { movement_lines: MovementLine[] };

export default async function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireMember(["admin"]);
  const sp = await searchParams;
  const kindParam = param(sp.kind);
  const kind = KINDS.includes(kindParam as MovementKind) ? (kindParam as MovementKind) : undefined;

  // Count first so an out-of-range page number lands on the last page instead of an empty list.
  let countQuery = supabase.from("movements").select("id", { count: "exact", head: true });
  if (kind) countQuery = countQuery.eq("kind", kind);
  const { count } = await countQuery;
  const page = pageOf(param(sp.page), count ?? 0, PAGE_SIZE);

  let rowsQuery = supabase.from("movements").select("*, movement_lines(*)").order("created_at", { ascending: false }).range(page.from, page.to);
  if (kind) rowsQuery = rowsQuery.eq("kind", kind);
  const [{ data: movs }, { data: prods }, { data: ings }] = await Promise.all([
    rowsQuery,
    supabase.from("products").select("id, name, unit"),
    supabase.from("ingredients").select("id, name, unit"),
  ]);
  const product = new Map(((prods ?? []) as Product[]).map((p) => [p.id, p]));
  const ingredient = new Map(((ings ?? []) as Ingredient[]).map((g) => [g.id, g]));
  const rows = (movs ?? []) as Row[];

  const detail = (m: Row) => {
    const shown = m.kind === "production" || (m.kind === "sale" && m.movement_lines.some((l) => l.product_id))
      ? m.movement_lines.filter((l) => l.product_id)
      : m.movement_lines;
    return shown.map((l) => {
      const item = l.product_id ? product.get(l.product_id) : ingredient.get(l.ingredient_id ?? "");
      const q = Number(l.qty);
      const extras = [l.weight_g ? `${l.weight_g} g` : "", l.expires_on ? `SKT ${shortDay(l.expires_on)}` : ""].filter(Boolean).join(", ");
      return `${item?.name ?? "?"} ${q > 0 ? "+" : "−"}${num(Math.abs(q))} ${item?.unit ?? ""}${extras ? ` (${extras})` : ""}`;
    }).join("; ");
  };

  return (
    <>
      <div className="page-head"><h1>Hareketler</h1></div>
      <p className="lead">Stok yalnızca bu hareketlerle değişir. Mal girişi ve üretimde girilen tarih ayrıca gösterilir.</p>
      <nav className="cats" aria-label="Hareket türü">
        <Link href="/app/movements" className="chip" aria-current={!kind ? "page" : undefined}>Tümü</Link>
        {KINDS.map((k) => (
          <Link key={k} href={`/app/movements?kind=${k}`} className="chip" aria-current={kind === k ? "page" : undefined}>{KIND_LABEL[k]}</Link>
        ))}
      </nav>
      {!rows.length ? <p className="panel empty">{kind ? "Bu türde hareket yok." : "Henüz hareket yok."}</p> : (
        <div className="panel">
          <ul className="moves">
            {rows.map((m) => (
              <li key={m.id}>
                <div className="moves-head">
                  <span className={`tag kind-${m.kind}`}>{KIND_LABEL[m.kind]}</span>
                  <span className="lead">{time(m.created_at)}{m.created_by_name ? `, ${m.created_by_name}` : ""}</span>
                  {Number(m.total) > 0 && <b className="moves-total">{tl(Number(m.total))}</b>}
                </div>
                <p>{detail(m)}</p>
                {(m.kind === "receipt" || m.kind === "production") && (
                  <small className="lead">{m.kind === "receipt" ? "Alış tarihi" : "Üretim tarihi"}: {shortDay(m.occurred_on)}{m.note ? `. Not: ${m.note}` : ""}</small>
                )}
              </li>
            ))}
          </ul>
          <Pager page={page} basePath="/app/movements" params={{ kind }} />
          <p className="lead" style={{ textAlign: "center", fontSize: 13, marginTop: 8 }}>Toplam {count ?? 0} hareket</p>
        </div>
      )}
    </>
  );
}
