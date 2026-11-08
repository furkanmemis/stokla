"use client";

import { useMemo, useState, useTransition } from "react";
import { recordSale } from "@/app/app/_actions/stock";
import { OTHER_CATEGORY, categoriesOf, stockLevel } from "@/lib/domain/stock";
import { tl, type Product, type Stocked } from "@/lib/types";
import { Icon } from "./Icon";
import { useToast } from "./useToast";

// Soft swatches give each tile a quick visual anchor; picked by product position so they stay stable.
const SWATCHES = ["#F6E3BF", "#E6D3C6", "#F7D3DA", "#D7E8DD", "#EAD9C9", "#DCE6F5"];
const EDGE_TOP = "M0 12 L0 6 " + Array.from({ length: 30 }, (_, i) => `L${i * 10 + 10} ${i % 2 ? 6 : 0}`).join(" ") + " L300 12 Z";
const EDGE_BOTTOM = "M0 0 L0 6 " + Array.from({ length: 30 }, (_, i) => `L${i * 10 + 10} ${i % 2 ? 6 : 12}`).join(" ") + " L300 0 Z";

/** Counter screen: tap a product once per unit; the receipt collects them until saved. */
export function SaleScreen({ products, placeId, picker }: { products: Stocked<Product>[]; placeId: string; picker?: React.ReactNode }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [waste, setWaste] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => categoriesOf(products), [products]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (q) return products.filter((p) => p.name.toLocaleLowerCase("tr-TR").includes(q) || p.barcode === q);
    if (!category) return products;
    return products.filter((p) => (p.category ?? OTHER_CATEGORY) === category);
  }, [products, query, category]);
  const lines = products.filter((p) => cart[p.id]).map((p) => ({ p, qty: cart[p.id] }));
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.qty * Number(l.p.price), 0);

  function add(p: Stocked<Product>) {
    const next = (cart[p.id] ?? 0) + 1;
    if (!p.made_to_order && next > Number(p.stock)) { toast.show(`Vitrinde ${p.name} kalmadı.`, true); return; }
    setCart({ ...cart, [p.id]: next });
    navigator.vibrate?.(12);
  }
  function remove(p: Stocked<Product>) {
    const next = { ...cart };
    if (--next[p.id] <= 0) delete next[p.id];
    setCart(next);
  }
  function switchMode(toWaste: boolean) { setWaste(toWaste); setCart({}); }
  function save() {
    start(async () => {
      const r = await recordSale(placeId, lines.map((l) => ({ id: l.p.id, qty: l.qty })), waste);
      if (!r.ok) { toast.show(r.error, true); return; }
      toast.show(`${waste ? "Fire kaydedildi" : "Satış kaydedildi"}: ${tl(total)}`);
      setCart({}); setOpen(false);
    });
  }
  // A scanner types the barcode and presses Enter: add the matching product right away.
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const hit = products.find((p) => p.barcode && p.barcode === query.trim());
    if (hit) { add(hit); setQuery(""); }
  }

  return (
    <>
      {toast.node}
      <div className="page-head">
        <div className="head-title"><h1>Satış</h1>{picker}</div>
        <div className="seg" role="group" aria-label="Kayıt türü">
          <button type="button" aria-pressed={!waste} onClick={() => switchMode(false)}>Satış</button>
          <button type="button" className="waste" aria-pressed={waste} onClick={() => switchMode(true)}>Fire</button>
        </div>
      </div>

      <div className="sell">
        <div className="catalog-col">
          <label className="search">
            <Icon name="search" />
            <span className="sr-only">Ürün ara ya da barkod okut</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey}
              placeholder="Ürün ara ya da barkod okut" enterKeyHint="search" />
          </label>
          {categories.length > 1 && (
            <div className="cats" role="group" aria-label="Kategori">
              <button type="button" aria-pressed={!category} onClick={() => setCategory(null)}>Tümü</button>
              {categories.map((c) => (
                <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          )}
          <p className="lead">{waste ? "Atılan ya da bozulan ürüne dokun." : "Satılan ürüne dokun; her dokunuş bir adet."}</p>
          {!products.length && <p className="panel empty">Satışa açık ürün yok. Admin, &quot;Ürünler ve tarifler&quot; bölümünden ürün eklemeli.</p>}
          <div className="tiles">
            {visible.map((p) => {
              const inCart = cart[p.id] ?? 0;
              const left = Number(p.stock) - inCart;
              const level = p.made_to_order ? "ok" : stockLevel(left, Number(p.min_stock));
              return (
                <button key={p.id} type="button" onClick={() => add(p)}
                  className={`tile ${inCart ? "in" : ""} ${waste ? "waste" : ""} ${!p.made_to_order && Number(p.stock) <= 0 ? "out" : ""}`}
                  aria-label={`${p.name}, ${tl(Number(p.price))}${inCart ? `, fişte ${inCart}` : ""}`}>
                  <span className="swatch" style={{ background: SWATCHES[(p.category ? categories.indexOf(p.category) : p.sort) % SWATCHES.length] }}>
                    <span>{p.weight_g ? `${p.weight_g} g` : p.unit}</span>
                    {inCart > 0 && <span className="count">{inCart}</span>}
                  </span>
                  <span className="name">{p.name}</span>
                  <span className="foot">
                    <span className="price">{tl(Number(p.price))}</span>
                    <span className={`left c-${level === "ok" ? "" : level}`}>
                      {p.made_to_order ? "Siparişle" : left <= 0 ? "Bitti" : `Vitrinde ${Number(left.toFixed(2))}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className={`receipt ${open ? "open" : ""}`} aria-label={waste ? "Fire fişi" : "Fiş"}>
          <svg className="edge" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d={EDGE_TOP} fill="#fff" /></svg>
          <div className="paper">
            <div className="total" style={{ alignItems: "center" }}>
              <h2>{waste ? "Fire fişi" : "Fiş"}</h2>
              <button type="button" className="receipt-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
                {count ? `${count} ürün` : "Boş"} {open ? "gizle" : "göster"}
              </button>
            </div>
            {lines.length ? (
              <ul className="lines">
                {lines.map(({ p, qty }) => (
                  <li key={p.id}>
                    <b style={{ width: 30 }}>{qty}×</b>
                    <span style={{ flex: 1, minWidth: 0 }}>{p.name}</span>
                    <b>{tl(qty * Number(p.price))}</b>
                    <button type="button" className="minus" onClick={() => remove(p)} aria-label={`${p.name} bir azalt`}>−</button>
                  </li>
                ))}
              </ul>
            ) : <p className="empty" style={{ borderTop: "2px dashed var(--sunken)", borderBottom: "2px dashed var(--sunken)" }}>Satılan ürüne dokun, buraya eklensin.</p>}
            <div className="total"><span className="lead" style={{ fontWeight: 700 }}>Toplam</span><b>{tl(total)}</b></div>
            <button type="button" className={`btn block ${waste ? "danger" : ""}`} disabled={!count || pending} onClick={save}>
              {pending ? "Kaydediliyor…" : waste ? "Fireyi kaydet" : "Satışı kaydet"}
            </button>
          </div>
          <svg className="edge bottom" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d={EDGE_BOTTOM} fill="#fff" /></svg>
        </aside>
      </div>
    </>
  );
}
