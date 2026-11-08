"use client";

import { useState, useTransition } from "react";
import { recordProduction } from "@/app/app/_actions/stock";
import { num, type Product } from "@/lib/types";
import { useToast } from "./useToast";

/** Kitchen screen: how many of each product was made today; ingredients are deducted by recipe. */
export function ProductionForm({ products, withRecipe }: { products: Product[]; withRecipe: string[] }) {
  const hasRecipe = new Set(withRecipe);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pending, start] = useTransition();
  const toast = useToast();
  const n = Object.values(qty).reduce((a, b) => a + b, 0);

  const step = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + d) }));
  function save() {
    const items = Object.entries(qty).filter(([, v]) => v > 0).map(([id, v]) => ({ id, qty: v }));
    start(async () => {
      const r = await recordProduction(items);
      if (!r.ok) { toast.show(r.error ?? "Kaydedilemedi.", true); return; }
      toast.show("Üretim kaydedildi, malzemeler stoktan düştü.");
      setQty({});
    });
  }

  if (!products.length) return <div className="empty">Henüz ürün yok. Patron &quot;Ürünler&quot; bölümünden ürün eklemeli.</div>;

  return (
    <>
      {toast.node}
      <div className="card">
        {products.map((p) => (
          <div className="row" key={p.id}>
            <span className="em" aria-hidden="true">{p.emoji || "📦"}</span>
            <span className="mid">
              <b>{p.name}</b>
              <small>Vitrinde {num(Number(p.stock))} {p.unit}{hasRecipe.has(p.id) ? "" : " · tarif yok"}</small>
            </span>
            <span className="stepper">
              <button type="button" onClick={() => step(p.id, -1)} aria-label={`${p.name} azalt`}>−</button>
              <output aria-live="polite">{qty[p.id] ?? 0}</output>
              <button type="button" onClick={() => step(p.id, 1)} aria-label={`${p.name} artır`}>+</button>
            </span>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <div className="bar"><div className="bar-in">
        <button type="button" className="btn ok" disabled={!n || pending} onClick={save}>
          {pending ? "Kaydediliyor…" : n ? `Üretimi kaydet · ${n} ürün` : "Adet gir"}
        </button>
      </div></div>
    </>
  );
}
