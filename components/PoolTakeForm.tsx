"use client";

import { useState, useTransition } from "react";
import { takeFromPool } from "@/app/app/_actions/stock";
import { checkTake, totalUnits } from "@/lib/domain/pool";
import { num, type Product } from "@/lib/types";
import { useToast } from "./useToast";

export type PoolItem = Product & { pool: number; shelf: number };

/** A selling place picks how many of each ready product to take from the pool onto its shelf. */
export function PoolTakeForm({ placeId, placeName, items }: { placeId: string; placeName: string; items: PoolItem[] }) {
  const ready = items.filter((p) => p.pool > 0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pending, start] = useTransition();
  const toast = useToast();

  const available = Object.fromEntries(ready.map((p) => [p.id, p.pool]));
  const names = Object.fromEntries(ready.map((p) => [p.id, p.name]));
  const set = (p: PoolItem, n: number) => setQty((q) => ({ ...q, [p.id]: Math.max(0, Math.min(p.pool, n)) }));
  const lines = Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ id, qty: n }));
  const units = totalUnits(lines);

  function take() {
    const checked = checkTake(lines, available, names);
    if (!checked.ok) { toast.show(checked.error, true); return; }
    start(async () => {
      const r = await takeFromPool(placeId, checked.lines);
      if (!r.ok) { toast.show(r.error, true); return; }
      toast.show(`${num(units)} ürün ${placeName} vitrinine eklendi.`);
      setQty({});
    });
  }

  if (!ready.length) return <p className="empty">Havuz boş. Üretim yapılınca ürünler burada görünür.</p>;

  return (
    <>
      {toast.node}
      {ready.map((p) => {
        const n = qty[p.id] ?? 0;
        return (
          <div className="prod-row" key={p.id}>
            <div style={{ minWidth: 0 }}>
              <b style={{ display: "block" }}>{p.name}</b>
              <small className="lead" style={{ fontSize: 13 }}>Havuzda {num(p.pool)} · vitrinde {num(p.shelf)} {p.unit}</small>
            </div>
            <div className="stepper">
              <button type="button" onClick={() => set(p, n - 1)} aria-label={`${p.name} azalt`}>−</button>
              <input type="number" inputMode="decimal" min={0} step="any" value={n || ""} placeholder="0"
                onChange={(e) => set(p, Number(e.target.value.replace(",", ".")) || 0)} aria-label={`${p.name} alınacak adet`} />
              <button type="button" onClick={() => set(p, n + 1)} aria-label={`${p.name} artır`}>+</button>
            </div>
          </div>
        );
      })}
      <div className="savebar">
        <button type="button" className="btn" disabled={!units || pending} onClick={take}>
          {pending ? "Ekleniyor…" : units ? `${placeName} vitrinine al · ${num(units)} ürün` : "Adet gir"}
        </button>
      </div>
    </>
  );
}
