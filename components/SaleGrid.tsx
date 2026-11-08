"use client";

import { useState, useTransition } from "react";
import { recordSale } from "@/app/app/_actions/stock";
import { stockLevel } from "@/lib/domain/stock";
import { tl, type Product } from "@/lib/types";
import { useToast } from "./useToast";

/** Counter screen: tap a product once per unit sold (or wasted), then save. */
export function SaleGrid({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [waste, setWaste] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = products.reduce((a, p) => a + (cart[p.id] ?? 0) * Number(p.price), 0);

  function tap(p: Product) {
    const n = (cart[p.id] ?? 0) + 1;
    if (n > Number(p.stock)) { toast.show(`Vitrinde ${p.name} kalmadı. Mutfak üretim girmeli.`, true); return; }
    setCart({ ...cart, [p.id]: n });
    if (navigator.vibrate) navigator.vibrate(15);
  }
  function save() {
    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    start(async () => {
      const r = await recordSale(items, waste);
      if (!r.ok) { toast.show(r.error ?? "Kaydedilemedi.", true); return; }
      toast.show(waste ? `Fire kaydedildi (${tl(total)})` : `Satış kaydedildi: ${tl(total)}`);
      setCart({});
    });
  }

  if (!products.length) return <div className="empty">Henüz satışa açık ürün yok. Patron &quot;Ürünler&quot; bölümünden ürün eklemeli.</div>;

  return (
    <>
      {toast.node}
      <div className="mode" role="group" aria-label="Kayıt türü">
        <button type="button" className={!waste ? "on" : ""} aria-pressed={!waste} onClick={() => { setWaste(false); setCart({}); }}>Satış</button>
        <button type="button" className={waste ? "on fire" : ""} aria-pressed={waste} onClick={() => { setWaste(true); setCart({}); }}>Fire / bozuldu</button>
      </div>
      <p className="sub">{waste ? "Atılan, bozulan ürünlere dokun." : "Satılan ürüne dokun, her dokunuş 1 adet."}</p>
      <div className="grid">
        {products.map((p) => {
          const c = cart[p.id] ?? 0;
          const left = Number(p.stock) - c;
          const level = stockLevel(left, Number(p.min_stock));
          const cls = level === "ok" ? "" : level;
          return (
            <button key={p.id} type="button" className={`p ${Number(p.stock) <= 0 ? "out" : ""}`} onClick={() => tap(p)}
              aria-label={`${p.name}, ${tl(Number(p.price))}, vitrinde ${left}${c ? `, sepette ${c}` : ""}`}>
              {c > 0 && <span className="badge" aria-hidden="true">{c}</span>}
              <span className="em" aria-hidden="true">{p.emoji || "📦"}</span>
              <span className="nm">{p.name}</span>
              <span className="pr">{tl(Number(p.price))}</span>
              <span className={`st ${cls}`}>{left <= 0 ? "Bitti" : `Vitrinde ${Number(left.toFixed(2))}`}</span>
            </button>
          );
        })}
      </div>
      <div className="spacer" />
      <div className="bar"><div className="bar-in">
        {count > 0 && <button type="button" className="btn ghost" style={{ flex: "0 0 auto" }} onClick={() => setCart({})}>Temizle</button>}
        <button type="button" className={`btn ${waste ? "bad" : ""}`} disabled={!count || pending} onClick={save}>
          {pending ? "Kaydediliyor…" : count ? `${waste ? "Fireyi kaydet" : "Satışı kaydet"} · ${count} ürün · ${tl(total)}` : "Ürüne dokun"}
        </button>
      </div></div>
    </>
  );
}
