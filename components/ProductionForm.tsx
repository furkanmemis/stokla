"use client";

import { useState, useTransition } from "react";
import { recordProduction } from "@/app/app/_actions/stock";
import { num, type Product, type Stocked } from "@/lib/types";
import { useToast } from "./useToast";

type Draft = { qty: number; weight: string; expires: string };

/** Kitchen screen: what was made on a day, with each batch's weight and optional expiry. */
export function ProductionForm({ products, withRecipe, today, placeId }: {
  products: Stocked<Product>[]; withRecipe: string[]; today: string; placeId: string;
}) {
  const hasRecipe = new Set(withRecipe);
  const blank = (p: Product): Draft => ({ qty: 0, weight: p.weight_g ? String(p.weight_g) : "", expires: "" });
  const [day, setDay] = useState(today);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pending, start] = useTransition();
  const toast = useToast();

  const get = (p: Product) => drafts[p.id] ?? blank(p);
  const patch = (p: Product, change: Partial<Draft>) => setDrafts((d) => ({ ...d, [p.id]: { ...(d[p.id] ?? blank(p)), ...change } }));
  const chosen = products.filter((p) => get(p).qty > 0);
  const units = chosen.reduce((a, p) => a + get(p).qty, 0);

  function save() {
    const items = chosen.map((p) => {
      const d = get(p);
      return { id: p.id, qty: d.qty, weight_g: d.weight ? Number(d.weight) : null, expires_on: d.expires || null };
    });
    start(async () => {
      const r = await recordProduction(placeId, items, day);
      if (!r.ok) { toast.show(r.error, true); return; }
      toast.show("Üretim kaydedildi, malzemeler stoktan düştü.");
      setDrafts({});
    });
  }

  if (!products.length) return <p className="panel empty">Henüz ürün yok. Admin, &quot;Ürünler ve tarifler&quot; bölümünden ürün eklemeli.</p>;

  return (
    <>
      {toast.node}
      <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <div className="field" style={{ margin: 0, flex: "0 1 220px" }}>
          <label htmlFor="prod-day">Üretim tarihi</label>
          <input id="prod-day" className="input" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
        </div>
        <p className="lead" style={{ flex: "1 1 260px" }}>Geçmiş bir günün üretimini de girebilirsin. Gramaj, ürün kartındaki değerle gelir; bu partide farklıysa değiştir.</p>
      </div>

      <div className="panel">
        {products.map((p) => {
          const d = get(p);
          return (
            <div className="prod-row" key={p.id}>
              <div style={{ minWidth: 0 }}>
                <b style={{ display: "block" }}>{p.name}</b>
                <small className="lead" style={{ fontSize: 13 }}>Havuzda {num(Number(p.stock))} {p.unit}{hasRecipe.has(p.id) ? "" : " · tarif yok, malzeme düşmez"}</small>
              </div>
              <div className="stepper">
                <button type="button" onClick={() => patch(p, { qty: Math.max(0, d.qty - 1) })} aria-label={`${p.name} azalt`}>−</button>
                <input type="number" inputMode="decimal" min={0} step="any" value={d.qty || ""} placeholder="0"
                  onChange={(e) => patch(p, { qty: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) })} aria-label={`${p.name} adedi`} />
                <button type="button" onClick={() => patch(p, { qty: d.qty + 1 })} aria-label={`${p.name} artır`}>+</button>
              </div>
              {d.qty > 0 && (
                <div className="extra">
                  <label>Gramaj (g / {p.unit})
                    <input className="input" type="number" inputMode="numeric" min={1} max={100000} value={d.weight}
                      onChange={(e) => patch(p, { weight: e.target.value })} placeholder="Örn. 80" />
                  </label>
                  <label>Son kullanma tarihi
                    <input className="input" type="date" min={day} value={d.expires} onChange={(e) => patch(p, { expires: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="savebar">
        <button type="button" className="btn go" disabled={!units || pending} onClick={save}>
          {pending ? "Kaydediliyor…" : units ? `Üretimi kaydet · ${num(units)} ürün` : "Adet gir"}
        </button>
      </div>
    </>
  );
}
