import type { Metadata } from "next";
import Link from "next/link";
import { getPlaces, requireMember } from "@/lib/session";
import { gaugePercent, lowStock, salesByPlace, stockLevel, summarizeDay, type LowRow } from "@/lib/domain/stock";
import { expiryLabel, shortDay, startOfTodayTR, todayTR } from "@/lib/domain/dates";
import { KIND_LABEL, num, tl, type ExpiringBatch, type Ingredient, type Movement, type MovementLine, type Product } from "@/lib/types";

export const metadata: Metadata = { title: "Genel bakış" };

const time = (iso: string) => new Date(iso).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });

export default async function OverviewPage() {
  const { supabase } = await requireMember(["admin"]);
  const today = todayTR();
  const [places, { data: movs }, { data: prods }, { data: ings }, { data: expiring }, { data: recent }, { data: pstock }, { data: istock }, { data: poolRows }] = await Promise.all([
    getPlaces(),
    supabase.from("movements").select("id, kind, total, created_at, location_id").gte("created_at", startOfTodayTR()),
    supabase.from("products").select("*").eq("active", true),
    supabase.from("ingredients").select("*").eq("active", true),
    supabase.rpc("expiring_batches", { p_days: 3 }),
    supabase.from("movements").select("*, movement_lines(product_id, ingredient_id, qty)").order("created_at", { ascending: false }).limit(6),
    supabase.from("stock_products").select("location_id, product_id, qty"),
    supabase.from("stock_ingredients").select("location_id, ingredient_id, qty"),
    supabase.from("pool_products").select("qty").gt("qty", 0),
  ]);
  const movements = (movs ?? []) as Pick<Movement, "id" | "kind" | "total" | "created_at" | "location_id">[];
  const products = (prods ?? []) as Product[];
  const ingredients = (ings ?? []) as Ingredient[];
  const placeName = new Map(places.map((p) => [p.id, p.name]));
  const inPool = ((poolRows ?? []) as { qty: number }[]).reduce((a, r) => a + Number(r.qty), 0);
  const openPlace = new Map(places.filter((p) => p.active).map((p) => [p.id, p]));
  const ids = movements.filter((m) => m.kind === "sale" || m.kind === "production").map((m) => m.id);
  const { data: lines } = ids.length
    ? await supabase.from("movement_lines").select("movement_id, product_id, qty").in("movement_id", ids)
    : { data: [] };

  const day = summarizeDay({ movements, lines: (lines ?? []) as MovementLine[] });
  const byPlace = salesByPlace(movements);
  // Only items a place actually keeps (it has a stock row) are checked, so a shop is not warned about flour.
  const productById = new Map(products.filter((p) => !p.made_to_order).map((p) => [p.id, p]));
  const ingredientById = new Map(ingredients.map((g) => [g.id, g]));
  const low = lowStock([
    ...((pstock ?? []) as { location_id: string; product_id: string; qty: number }[]).flatMap((r): LowRow[] => {
      const p = productById.get(r.product_id); const at = openPlace.get(r.location_id);
      return p && at ? [{ placeId: at.id, placeName: at.name, kind: "product", id: p.id, name: p.name, unit: p.unit, qty: Number(r.qty), min: at.can_sell ? Number(p.min_stock) : 0 }] : [];
    }),
    ...((istock ?? []) as { location_id: string; ingredient_id: string; qty: number }[]).flatMap((r): LowRow[] => {
      const g = ingredientById.get(r.ingredient_id); const at = openPlace.get(r.location_id);
      return g && at ? [{ placeId: at.id, placeName: at.name, kind: "ingredient", id: g.id, name: g.name, unit: g.unit, qty: Number(r.qty), min: Number(g.min_stock) }] : [];
    }),
  ]).slice(0, 10);
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const ingredientName = new Map(ingredients.map((g) => [g.id, g]));
  const peak = Math.max(...day.hourly.map((h) => h.revenue), 0);
  const peakHour = day.hourly.find((h) => h.revenue === peak && peak > 0)?.hour;
  const batches = ((expiring ?? []) as ExpiringBatch[]).slice(0, 6);

  const describe = (m: Movement & { movement_lines: Pick<MovementLine, "product_id" | "ingredient_id" | "qty">[] }) => {
    const shown = m.kind === "production" ? m.movement_lines.filter((l) => l.product_id) : m.movement_lines;
    return shown.map((l) => {
      const q = Math.abs(Number(l.qty));
      if (l.product_id) return `${num(q)} ${productName.get(l.product_id) ?? "ürün"}`;
      const g = ingredientName.get(l.ingredient_id ?? "");
      return `${g?.name ?? "Malzeme"} ${Number(l.qty) > 0 ? "+" : "−"}${num(q)} ${g?.unit ?? ""}`;
    }).join(", ");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">{new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>Genel bakış</h1>
        </div>
        <div className="actions">
          <Link className="btn secondary" href="/app/pool">Ürün havuzu · {num(inPool)}</Link>
          <Link className="btn" href="/app/sales">Satış ekranını aç</Link>
        </div>
      </div>

      {!places.length && (
        <p className="alert warn">Henüz yer eklemedin. Satış, üretim ve stok her yer için ayrı tutulur. <Link href="/app/places?new=1">İlk yerini ekle</Link></p>
      )}
      {!products.length && (
        <p className="alert warn">Dükkânında henüz ürün yok. <Link href="/app/catalog">Ürünler ve tarifler</Link> bölümünden ekle ya da örnek pastane verilerini yükle.</p>
      )}

      <section className="panel day" aria-labelledby="h-day">
        <div className="main">
          <h2 id="h-day" style={{ fontSize: 16, color: "var(--muted)", fontWeight: 700, margin: 0 }}>Bugünkü satış</h2>
          <p className="big">{tl(day.revenue)}</p>
          <div className="hours" role="img" aria-label={peakHour !== undefined ? `Saat saat satış, en yoğun saat ${peakHour}.00` : "Bugün henüz satış yok"}>
            {day.hourly.map((h) => (
              <div key={h.hour}>
                <i className={h.revenue === peak && peak > 0 ? "peak" : ""} style={{ height: `${peak ? Math.max(2, (h.revenue / peak) * 100) : 2}%` }} />
                <span>{String(h.hour).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
        </div>
        <dl className="facts">
          <div><dt>Satılan</dt><dd>{num(day.unitsSold)} adet</dd></div>
          <div><dt>Üretilen</dt><dd className="c-ok">{num(day.unitsMade)} adet</dd></div>
          <div><dt>Fire</dt><dd className={day.waste ? "c-out" : ""}>{tl(day.waste)}</dd></div>
          {byPlace.map((b) => (
            <div key={b.placeId}><dt>{placeName.get(b.placeId) ?? "—"}</dt><dd>{tl(b.revenue)}</dd></div>
          ))}
        </dl>
      </section>

      <div className="row">
        <section className="panel wide" aria-labelledby="h-low">
          <div className="panel-head"><h2 id="h-low">Bitmek üzere</h2><Link href="/app/stock">Tüm stok</Link></div>
          {low.length ? (
            <ul className="list">
              {low.map((r) => {
                const level = stockLevel(r.qty, r.min);
                return (
                  <li key={`${r.placeId}-${r.kind}-${r.id}`} className="low-row">
                    <span><b>{r.name}</b><small>{r.placeName} · en az {num(r.min)} {r.unit}</small></span>
                    <span className="gauge"><i className={level} style={{ width: `${gaugePercent(r.qty, r.min)}%` }} /></span>
                    <b className={`c-${level}`} style={{ whiteSpace: "nowrap" }}>{num(r.qty)} {r.unit}</b>
                  </li>
                );
              })}
            </ul>
          ) : <p className="empty">Azalan malzeme ya da ürün yok.</p>}
        </section>

        <section className="panel" aria-labelledby="h-exp">
          <h2 id="h-exp">Son kullanma yaklaşanlar</h2>
          {batches.length ? (
            <ul className="list">
              {batches.map((b, i) => {
                const name = b.product_id ? productName.get(b.product_id) : ingredientName.get(b.ingredient_id ?? "")?.name;
                const unit = b.product_id ? "" : ingredientName.get(b.ingredient_id ?? "")?.unit ?? "";
                const past = b.expires_on < today;
                return (
                  <li key={i}>
                    <span className="grow"><b>{name ?? "—"}</b><small>{num(Number(b.qty))} {unit} · {b.location_id ? `${placeName.get(b.location_id) ?? ""}, ` : ""}{b.product_id ? "üretim" : "alış"} {shortDay(b.occurred_on)}</small></span>
                    <span className={`tag ${past || b.expires_on === today ? "kind-waste" : "kind-production"}`}>{expiryLabel(b.expires_on, today)}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="empty">Önümüzdeki 3 günde son kullanma tarihi dolan bir şey yok.</p>}
        </section>
      </div>

      <div className="row">
        <section className="panel" aria-labelledby="h-top">
          <h2 id="h-top">En çok satanlar</h2>
          {day.topSellers.length ? (
            <ol className="list">
              {day.topSellers.map((t, i) => (
                <li key={t.productId}><b style={{ width: 22, color: "var(--muted)" }}>{i + 1}</b><span className="grow"><b>{productName.get(t.productId) ?? "Ürün"}</b></span><b>{num(t.qty)}</b></li>
              ))}
            </ol>
          ) : <p className="empty">Bugün henüz satış yok.</p>}
        </section>

        <section className="panel wide" aria-labelledby="h-moves">
          <div className="panel-head"><h2 id="h-moves">Son hareketler</h2><Link href="/app/movements">Tümü</Link></div>
          {(recent ?? []).length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Saat</th><th>Tür</th><th className="hide-sm">Yer</th><th>Ne oldu</th><th className="hide-sm">Kim</th><th className="num">Tutar</th></tr></thead>
                <tbody>
                  {((recent ?? []) as (Movement & { movement_lines: Pick<MovementLine, "product_id" | "ingredient_id" | "qty">[] })[]).map((m) => (
                    <tr key={m.id}>
                      <td className="lead">{time(m.created_at)}</td>
                      <td><span className={`tag kind-${m.kind}`}>{KIND_LABEL[m.kind]}</span></td>
                      <td className="hide-sm lead">{m.location_id ? placeName.get(m.location_id) ?? "—" : "—"}</td>
                      <td>{describe(m)}</td>
                      <td className="hide-sm lead">{m.created_by_name ?? "—"}</td>
                      <td className="num"><b>{Number(m.total) > 0 ? tl(Number(m.total)) : ""}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty">Henüz hareket yok.</p>}
        </section>
      </div>
    </>
  );
}
