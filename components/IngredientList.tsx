"use client";

import { useState, useTransition } from "react";
import { countIngredient, receiveIngredient } from "@/app/app/_actions/stock";
import { stockLevel } from "@/lib/domain/stock";
import { num, type Ingredient, type Role } from "@/lib/types";
import { useToast } from "./useToast";

/** Ingredient stock with "goods received" and (owner/depot) "stock count" in a bottom sheet. */
export function IngredientList({ ingredients, role }: { ingredients: Ingredient[]; role: Role }) {
  const [open, setOpen] = useState<Ingredient | null>(null);
  const [mode, setMode] = useState<"receive" | "count">("receive");
  const [val, setVal] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const canCount = role === "owner" || role === "depot";

  const sorted = [...ingredients].sort((a, b) => Number(a.stock) / (Number(a.min_stock) || 1) - Number(b.stock) / (Number(b.min_stock) || 1));

  function openSheet(g: Ingredient) { setOpen(g); setMode("receive"); setVal(""); }
  function save() {
    if (!open) return;
    const v = Number(val.replace(",", "."));
    start(async () => {
      const r = mode === "receive" ? await receiveIngredient(open.id, v) : await countIngredient(open.id, v);
      if (!r.ok) { toast.show(r.error ?? "Kaydedilemedi.", true); return; }
      toast.show(mode === "receive" ? `${open.name}: +${num(v)} ${open.unit} eklendi` : `${open.name} sayımı kaydedildi`);
      setOpen(null);
    });
  }

  if (!ingredients.length) return <div className="empty">Henüz malzeme yok. Patron &quot;Ürünler&quot; bölümünden malzeme eklemeli.</div>;

  return (
    <>
      {toast.node}
      <div className="card">
        {sorted.map((g) => {
          const level = stockLevel(Number(g.stock), Number(g.min_stock));
          const lv = level === "out" ? "bad" : level === "low" ? "low" : "";
          const pct = Math.min(100, (Number(g.stock) / Math.max(Number(g.min_stock) * 3, 0.001)) * 100);
          return (
            <button key={g.id} type="button" className="row" style={{ width: "100%", textAlign: "left" }} onClick={() => openSheet(g)}>
              <span className="mid">
                <b>{g.name}</b>
                <small>{lv === "bad" ? "Bitti" : lv === "low" ? "Azaldı, sipariş ver" : "Yeterli"}</small>
                <span className="meter" aria-hidden="true"><i className={lv} style={{ width: `${pct}%` }} /></span>
              </span>
              <span className="qty">{num(Number(g.stock))} {g.unit}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <h3 id="sheet-title">{open.name}</h3>
            <p className="hint" style={{ marginTop: 0 }}>Şu an: <b>{num(Number(open.stock))} {open.unit}</b> · en az {num(Number(open.min_stock))} {open.unit} olmalı</p>
            {canCount && (
              <div className="seg" role="group" aria-label="İşlem">
                <button type="button" className={mode === "receive" ? "on" : ""} aria-pressed={mode === "receive"} onClick={() => setMode("receive")}>Mal geldi</button>
                <button type="button" className={mode === "count" ? "on" : ""} aria-pressed={mode === "count"} onClick={() => setMode("count")}>Sayım</button>
              </div>
            )}
            <label className="lbl" htmlFor="qin">{mode === "receive" ? `Gelen miktar (${open.unit})` : `Rafta sayılan (${open.unit})`}</label>
            <input id="qin" className="numin" type="number" inputMode="decimal" min={0} step="any" autoFocus value={val} onChange={(e) => setVal(e.target.value)} />
            {mode === "receive" ? (
              <div className="quick">
                {(open.unit === "adet" ? [30, 90, 180] : [1, 5, 10, 25]).map((q) => (
                  <button key={q} type="button" onClick={() => setVal(String((Number(val.replace(",", ".")) || 0) + q))}>+{q}</button>
                ))}
              </div>
            ) : <div style={{ height: 12 }} />}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setOpen(null)}>Vazgeç</button>
              <button type="button" className={`btn ${mode === "receive" ? "" : "ok"}`} style={{ flex: 1 }} disabled={pending || val === ""} onClick={save}>
                {pending ? "Kaydediliyor…" : mode === "receive" ? "Stoğa ekle" : "Sayımı kaydet"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
