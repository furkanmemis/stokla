"use client";

import { useState, useTransition } from "react";
import { countIngredient, countProduct, receiveIngredient } from "@/app/app/_actions/stock";
import { gaugePercent, stockLevel } from "@/lib/domain/stock";
import { shortDay } from "@/lib/domain/dates";
import { num, type Ingredient, type Product, type Role, type Stocked } from "@/lib/types";
import { Icon } from "./Icon";
import { useToast } from "./useToast";

type Item = { id: string; name: string; unit: string; stock: number; min: number; kind: "ingredient" | "product" };
type Mode = "receive" | "count";

/** Adds a quick amount to what was typed, keeping the Turkish decimal comma. */
const addTo = (typed: string, n: number) =>
  String(Math.round(((Number(typed.replace(",", ".")) || 0) + n) * 1000) / 1000).replace(".", ",");

const toItem = (x: Stocked<Ingredient> | Stocked<Product>, kind: Item["kind"]): Item =>
  ({ id: x.id, name: x.name, unit: x.unit, stock: Number(x.stock), min: Number(x.min_stock), kind });

/**
 * Stock list with a side panel (a bottom sheet on phones) for goods received and stock counts.
 * Employees record goods received; only admins count.
 */
export function StockScreen(props: {
  view: "ingredients" | "products"; ingredients: Stocked<Ingredient>[]; products: Stocked<Product>[];
  lastReceipt: Record<string, string>; role: Role; today: string; placeId: string; productsLabel: string;
}) {
  const { view, role, today, lastReceipt, placeId, productsLabel } = props;
  const isAdmin = role === "admin";
  const items = (view === "ingredients" ? props.ingredients.map((g) => toItem(g, "ingredient")) : props.products.map((p) => toItem(p, "product")))
    .sort((a, b) => a.stock / (a.min || 1) - b.stock / (b.min || 1));
  const canOpen = view === "ingredients" || isAdmin;

  const [selected, setSelected] = useState<Item | null>(null);
  const [mode, setMode] = useState<Mode>("receive");
  const [qty, setQty] = useState("");
  const [day, setDay] = useState(today);
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  function open(item: Item) {
    setSelected(item);
    setMode(item.kind === "product" ? "count" : "receive");
    setQty(""); setDay(today); setExpires(""); setNote("");
  }
  const value = Number(qty.replace(",", "."));
  const valid = qty !== "" && Number.isFinite(value) && (mode === "receive" ? value > 0 : value >= 0);
  const after = selected && valid ? (mode === "receive" ? selected.stock + value : value) : null;

  function save() {
    if (!selected || !valid) return;
    start(async () => {
      const r = selected.kind === "product"
        ? await countProduct(placeId, selected.id, value)
        : mode === "receive"
          ? await receiveIngredient(placeId, selected.id, value, note, { day, expiresOn: expires || null })
          : await countIngredient(placeId, selected.id, value);
      if (!r.ok) { toast.show(r.error, true); return; }
      toast.show(mode === "receive" ? `${selected.name}: +${num(value)} ${selected.unit} eklendi` : `${selected.name} sayımı kaydedildi`);
      setSelected(null);
    });
  }

  return (
    <>
      {toast.node}
      <div className="split">
        <div className="main">
          {!items.length ? (
            <p className="panel empty">{view === "ingredients" ? "Henüz malzeme yok." : "Henüz ürün yok."} Admin, &quot;Ürünler ve tarifler&quot; bölümünden ekleyebilir.</p>
          ) : (
            <div className="panel table-wrap">
              <table className="data">
                <thead><tr>
                  <th>{view === "ingredients" ? "Malzeme" : "Ürün"}</th>
                  <th style={{ width: "36%" }}>Doluluk</th>
                  <th className="num">Elde</th>
                  {view === "ingredients" && <th className="num hide-sm">Son giriş</th>}
                </tr></thead>
                <tbody>
                  {items.map((it) => {
                    const level = stockLevel(it.stock, it.min);
                    return (
                      <tr key={it.id} className={`${canOpen ? "pick" : ""} ${selected?.id === it.id ? "selected" : ""}`} onClick={canOpen ? () => open(it) : undefined}>
                        <td>{canOpen
                          ? <button type="button" className="rowbtn" onClick={(e) => { e.stopPropagation(); open(it); }}>{it.name}</button>
                          : <b>{it.name}</b>}
                          <small className="lead" style={{ display: "block", fontSize: 13 }}>En az {num(it.min)} {it.unit}</small>
                        </td>
                        <td><div className="gauge" role="img" aria-label={`Doluluk yüzde ${gaugePercent(it.stock, it.min)}`}><i className={level === "ok" ? "" : level} style={{ width: `${gaugePercent(it.stock, it.min)}%` }} /></div></td>
                        <td className={`num c-${level}`}><b>{num(it.stock)} {it.unit}</b></td>
                        {view === "ingredients" && <td className="num hide-sm lead">{lastReceipt[it.id] ? shortDay(lastReceipt[it.id]) : "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected ? (
          <>
            <div className="scrim" onClick={() => setSelected(null)} aria-hidden="true" />
            <section className="side" role="dialog" aria-modal="false" aria-labelledby="side-title">
              <button type="button" className="icon-btn side-close" onClick={() => setSelected(null)} aria-label="Kapat"><Icon name="close" /></button>
              <h2 id="side-title">{selected.name}</h2>
              <p className="sub">Elde {num(selected.stock)} {selected.unit}, en az {num(selected.min)} {selected.unit} olmalı</p>

              {selected.kind === "ingredient" && isAdmin && (
                <div className="seg" role="group" aria-label="İşlem" style={{ marginBottom: 16, display: "flex" }}>
                  <button type="button" style={{ flex: 1 }} aria-pressed={mode === "receive"} onClick={() => setMode("receive")}>Mal geldi</button>
                  <button type="button" style={{ flex: 1 }} aria-pressed={mode === "count"} onClick={() => setMode("count")}>Sayım</button>
                </div>
              )}

              <div className="field">
                <label htmlFor="side-qty">{mode === "receive" ? `Gelen miktar (${selected.unit})` : `Sayılan miktar (${selected.unit})`}</label>
                <input id="side-qty" className="input big" type="text" inputMode="decimal" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              {mode === "receive" && (
                <>
                  <div className="chips">
                    {(selected.unit === "adet" ? [30, 60, 90, 180] : [1, 5, 10, 25]).map((n) => (
                      <button key={n} type="button" onClick={() => setQty(addTo(qty, n))}>+{n}</button>
                    ))}
                  </div>
                  <div className="fields">
                    <div className="field">
                      <label htmlFor="side-day">Alış tarihi</label>
                      <input id="side-day" className="input" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} />
                    </div>
                    <div className="field">
                      <label htmlFor="side-exp">Son kullanma <span className="hint">(isteğe bağlı)</span></label>
                      <input id="side-exp" className="input" type="date" min={day} value={expires} onChange={(e) => setExpires(e.target.value)} />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="side-note">Not <span className="hint">(isteğe bağlı)</span></label>
                    <input id="side-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. toptancı, fatura no" />
                  </div>
                </>
              )}
              {after !== null && <p className="preview">Kaydedince elde {num(after)} {selected.unit} olacak.</p>}
              <button type="button" className={`btn block ${mode === "count" ? "go" : ""}`} disabled={!valid || pending} onClick={save}>
                {pending ? "Kaydediliyor…" : mode === "receive" ? "Stoğa ekle" : "Sayımı kaydet"}
              </button>
            </section>
          </>
        ) : (
          <aside className="side hint-side" style={{ boxShadow: "none" }} aria-label="Bilgi">
            <h2 style={{ fontSize: 18 }}>{view === "ingredients" ? "Mal geldi mi?" : `${productsLabel} sayımı`}</h2>
            <p className="sub" style={{ marginBottom: 0 }}>
              {view === "ingredients"
                ? "Listeden malzemeye dokun, gelen miktarı, alış tarihini ve varsa son kullanma tarihini gir."
                : isAdmin ? "Listeden ürüne dokun ve saydığın adedi gir." : "Ürün sayımını admin yapar. Ürünler üretimle ve teslim alınan gönderimlerle gelir."}
            </p>
          </aside>
        )}
      </div>
    </>
  );
}
