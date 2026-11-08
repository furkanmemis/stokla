import type { Metadata } from "next";
import { requireMember } from "@/lib/session";
import { KIND_LABEL, num, tl, type Ingredient, type Movement, type MovementLine, type Product } from "@/lib/types";

export const metadata: Metadata = { title: "Hareketler" };

const time = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function MovementsPage() {
  const { supabase } = await requireMember(["owner"]);
  const { data: movs } = await supabase.from("movements").select("*").order("created_at", { ascending: false }).limit(80);
  const movements = (movs ?? []) as Movement[];
  const ids = movements.map((m) => m.id);
  const [{ data: lines }, { data: prods }, { data: ings }] = await Promise.all([
    ids.length ? supabase.from("movement_lines").select("*").in("movement_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("products").select("id, name, unit"),
    supabase.from("ingredients").select("id, name, unit"),
  ]);
  const pName = new Map(((prods ?? []) as Product[]).map((p) => [p.id, p]));
  const gName = new Map(((ings ?? []) as Ingredient[]).map((g) => [g.id, g]));
  const byMov = new Map<string, MovementLine[]>();
  ((lines ?? []) as MovementLine[]).forEach((l) => byMov.set(l.movement_id, [...(byMov.get(l.movement_id) ?? []), l]));

  return (
    <main className="wrap">
      <h2>Hareketler</h2>
      <p className="sub">Son 80 kayıt. Stok sadece bu hareketlerle değişir.</p>
      {!movements.length ? <div className="empty">Henüz hareket yok.</div> : (
        <div className="card">
          {movements.map((m) => {
            const ls = byMov.get(m.id) ?? [];
            const shown = m.kind === "production" ? ls.filter((l) => l.product_id) : ls;
            const what = shown.map((l) => {
              const it = l.product_id ? pName.get(l.product_id) : gName.get(l.ingredient_id ?? "");
              const q = Number(l.qty);
              return `${it?.name ?? "?"} ${q > 0 ? "+" : ""}${num(q)} ${it?.unit ?? ""}`;
            }).join(", ");
            return (
              <div className="row" key={m.id} style={{ alignItems: "flex-start" }}>
                <span className="mid">
                  <span className={`tag ${m.kind}`}>{KIND_LABEL[m.kind]}</span>{" "}
                  <small>{time(m.created_at)} · {m.created_by_name ?? "—"}</small>
                  <div style={{ marginTop: 4 }}>{what}{m.note ? ` · ${m.note}` : ""}</div>
                </span>
                {Number(m.total) > 0 && <span className="qty">{tl(Number(m.total))}</span>}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
