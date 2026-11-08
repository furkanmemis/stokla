import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/session";
import { summarizeDay } from "@/lib/domain/stock";
import { num, startOfTodayTR, tl, type Ingredient, type Movement, type MovementLine, type Product } from "@/lib/types";

export const metadata: Metadata = { title: "Bugün" };

export default async function TodayPage() {
  const { supabase } = await requireMember(["owner"]);
  const [{ data: movs }, { data: prods }, { data: ings }] = await Promise.all([
    supabase.from("movements").select("id, kind, total").in("kind", ["sale", "waste"]).gte("created_at", startOfTodayTR()),
    supabase.from("products").select("*").eq("active", true),
    supabase.from("ingredients").select("*").eq("active", true),
  ]);
  const movements = (movs ?? []) as Pick<Movement, "id" | "kind" | "total">[];
  const products = (prods ?? []) as Product[];
  const saleIds = movements.filter((m) => m.kind === "sale").map((m) => m.id);
  const { data: lines } = saleIds.length
    ? await supabase.from("movement_lines").select("movement_id, product_id, qty").in("movement_id", saleIds)
    : { data: [] };

  const day = summarizeDay({
    movements,
    saleLines: (lines ?? []) as MovementLine[],
    products,
    ingredients: (ings ?? []) as Ingredient[],
  });
  const product = new Map(products.map((p) => [p.id, p]));
  const maxQty = day.topSellers[0]?.qty || 1;

  return (
    <main className="wrap">
      <h2>Bugün</h2>
      <div className="kpis">
        <div className="kpi"><small>Ciro</small><b>{tl(day.revenue)}</b></div>
        <div className="kpi"><small>Satılan</small><b>{num(day.unitsSold)}</b></div>
        <div className="kpi"><small>Fire</small><b style={{ color: day.waste ? "var(--bad)" : undefined }}>{tl(day.waste)}</b></div>
      </div>

      {day.lowIngredients.map((g) => (
        <div key={g.id} className={`alert ${Number(g.stock) <= 0 ? "err" : "warn"}`}>
          <b>{g.name}</b> azaldı: {num(Number(g.stock))} {g.unit} kaldı (en az {num(Number(g.min_stock))}). Sipariş ver.
        </div>
      ))}
      {day.lowProducts.map((p) => (
        <div key={p.id} className="alert warn">Vitrinde <b>{p.name}</b> az: {num(Number(p.stock))} {p.unit}. Mutfağa haber ver.</div>
      ))}
      {!day.lowIngredients.length && !day.lowProducts.length && products.length > 0 && (
        <div className="alert ok">Her şey yolunda, azalan malzeme yok.</div>
      )}
      {!products.length && (
        <div className="card">Dükkânında henüz ürün yok. <Link href="/app/catalog">Ürünler</Link> bölümünden ekle ya da örnek pastane verilerini yükle.</div>
      )}

      <div className="card bars">
        <h3>En çok satanlar</h3>
        {day.topSellers.length ? day.topSellers.map(({ productId, qty }) => (
          <div className="b" key={productId}>
            <span>{product.get(productId)?.emoji} {product.get(productId)?.name ?? "Ürün"}</span>
            <span className="t" aria-hidden="true"><i style={{ width: `${(qty / maxQty) * 100}%` }} /></span>
            <b>{num(qty)}</b>
          </div>
        )) : <div className="empty">Bugün henüz satış yok.</div>}
      </div>
    </main>
  );
}
