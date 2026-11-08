import type { Metadata } from "next";
import { requireMember } from "@/lib/session";
import { shortDay } from "@/lib/domain/dates";
import { KIND_LABEL, num, tl, type Ingredient, type Movement, type MovementLine, type Product } from "@/lib/types";

export const metadata: Metadata = { title: "Hareketler" };

const time = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Row = Movement & { movement_lines: MovementLine[] };

export default async function MovementsPage() {
  const { supabase } = await requireMember(["admin"]);
  const [{ data: movs }, { data: prods }, { data: ings }] = await Promise.all([
    supabase.from("movements").select("*, movement_lines(*)").order("created_at", { ascending: false }).limit(100),
    supabase.from("products").select("id, name, unit"),
    supabase.from("ingredients").select("id, name, unit"),
  ]);
  const product = new Map(((prods ?? []) as Product[]).map((p) => [p.id, p]));
  const ingredient = new Map(((ings ?? []) as Ingredient[]).map((g) => [g.id, g]));
  const rows = (movs ?? []) as Row[];

  const detail = (m: Row) => {
    const shown = m.kind === "production" ? m.movement_lines.filter((l) => l.product_id) : m.movement_lines;
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
      <p className="lead">Son 100 kayıt. Stok yalnızca bu hareketlerle değişir. Mal girişi ve üretimde girilen tarih ayrıca gösterilir.</p>
      {!rows.length ? <p className="panel empty">Henüz hareket yok.</p> : (
        <div className="panel table-wrap">
          <table className="data">
            <thead><tr><th>Kayıt</th><th>Tür</th><th>Ne oldu</th><th className="hide-sm">Kim</th><th className="num">Tutar</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="lead" style={{ whiteSpace: "nowrap" }}>
                    {time(m.created_at)}
                    {(m.kind === "receipt" || m.kind === "production") && <small style={{ display: "block" }}>{m.kind === "receipt" ? "Alış" : "Üretim"}: {shortDay(m.occurred_on)}</small>}
                  </td>
                  <td><span className={`tag ${m.kind}`}>{KIND_LABEL[m.kind]}</span></td>
                  <td>{detail(m)}{m.note ? <small className="lead" style={{ display: "block" }}>{m.note}</small> : null}</td>
                  <td className="hide-sm lead">{m.created_by_name ?? "—"}</td>
                  <td className="num"><b>{Number(m.total) > 0 ? tl(Number(m.total)) : ""}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
