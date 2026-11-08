import type { Metadata } from "next";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { PlacePicker } from "@/components/PlacePicker";
import { PoolTakeForm, type PoolItem } from "@/components/PoolTakeForm";
import { requirePlace } from "@/lib/session";
import { productsAt } from "@/lib/queries";
import { fits } from "@/lib/domain/places";
import { num } from "@/lib/types";
import { countPoolForm } from "../_actions/stock";

export const metadata: Metadata = { title: "Ürün havuzu" };

export default async function PoolPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, member, place, places } = await requirePlace();
  const sp = await searchParams;
  const isAdmin = member.role === "admin";
  // Taking needs a selling place: the employee's own, or for an admin the picked one (or the first that sells).
  const sellPlaces = places.filter((p) => p.active && fits(p, "sell"));
  const target = place.can_sell ? place : isAdmin ? sellPlaces[0] ?? null : null;
  const [shelf, { data: poolRows }] = await Promise.all([
    target ? productsAt(supabase, target.id, { madeToOrder: false }) : productsAt(supabase, place.id, { madeToOrder: false }),
    supabase.from("pool_products").select("product_id, qty"),
  ]);
  const pool = new Map(((poolRows ?? []) as { product_id: string; qty: number }[]).map((r) => [r.product_id, Number(r.qty)]));
  const items: PoolItem[] = shelf.map((p) => ({ ...p, pool: pool.get(p.id) ?? 0, shelf: target ? Number(p.stock) : 0 }));
  const inPool = items.filter((p) => p.pool > 0);
  const total = inPool.reduce((a, p) => a + p.pool, 0);

  return (
    <>
      <div className="page-head">
        <div className="head-title">
          <h1>Ürün havuzu</h1>
          {target && <PlacePicker current={target} options={sellPlaces} canSwitch={isAdmin} />}
        </div>
      </div>
      <p className="lead">
        Hangi yerde üretilirse üretilsin, ürünler bu ortak havuza girer. Satış yapan yerler vitrinlerine buradan alır; alınan ürün havuzdan düşer.
      </p>
      <Alert error={param(sp.error)} info={param(sp.ok)} />

      <div className="row">
        {target ? (
          <section className="panel wide" aria-labelledby="h-take">
            <h2 id="h-take">{target.name} vitrinine al</h2>
            <PoolTakeForm key={target.id} placeId={target.id} placeName={target.name} items={items} />
          </section>
        ) : (
          <section className="panel wide">
            <h2>Havuzu doldur</h2>
            <p className="lead">{place.name} üretim yapıyor; ürettiğin her şey buraya eklenir. Satış yerleri vitrinlerine buradan alır.</p>
          </section>
        )}

        <section className="panel" aria-labelledby="h-pool">
          <h2 id="h-pool">Havuzda ne var?</h2>
          <p className="lead" style={{ marginTop: 0 }}>Toplam {num(total)} ürün</p>
          {inPool.length ? (
            <ul className="list">
              {inPool.map((p) => (
                <li key={p.id} style={{ display: "block" }}>
                  {isAdmin ? (
                    <details className="edit">
                      <summary style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className="grow" style={{ flex: 1 }}><b>{p.name}</b></span>
                        <b>{num(p.pool)} {p.unit}</b>
                      </summary>
                      <form action={countPoolForm} className="inline-form" style={{ marginTop: 8 }}>
                        <input type="hidden" name="id" value={p.id} />
                        <label className="sr-only" htmlFor={`cnt-${p.id}`}>{p.name} sayılan adet</label>
                        <input className="input" id={`cnt-${p.id}`} name="counted" inputMode="decimal" placeholder="Sayılan adet" />
                        <button className="btn small secondary" type="submit">Sayımı kaydet</button>
                      </form>
                    </details>
                  ) : (
                    <span style={{ display: "flex", gap: 12 }}><span style={{ flex: 1 }}><b>{p.name}</b></span><b>{num(p.pool)} {p.unit}</b></span>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="empty">Havuz boş.</p>}
        </section>
      </div>
    </>
  );
}
