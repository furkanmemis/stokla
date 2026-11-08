import type { Metadata } from "next";
import { PlacePicker } from "@/components/PlacePicker";
import { ProductionForm } from "@/components/ProductionForm";
import { requirePlace } from "@/lib/session";
import { productsAt } from "@/lib/queries";
import { todayTR } from "@/lib/domain/dates";
import { fits } from "@/lib/domain/places";
import type { RecipeItem } from "@/lib/types";

export const metadata: Metadata = { title: "Üretim" };

export default async function ProductionPage() {
  const { supabase, member, place, places } = await requirePlace("produce");
  const [catalog, { data: pool }, { data: recipe }] = await Promise.all([
    productsAt(supabase, place.id, { madeToOrder: false }),
    supabase.from("pool_products").select("product_id, qty"),
    supabase.from("recipe_items").select("product_id"),
  ]);
  // Production fills the shared pool, so the form shows how many are already there.
  const inPool = new Map(((pool ?? []) as { product_id: string; qty: number }[]).map((r) => [r.product_id, Number(r.qty)]));
  const products = catalog.map((p) => ({ ...p, stock: inPool.get(p.id) ?? 0 }));
  const withRecipe = [...new Set(((recipe ?? []) as Pick<RecipeItem, "product_id">[]).map((r) => r.product_id))];
  return (
    <>
      <div className="page-head">
        <div className="head-title">
          <h1>Üretim</h1>
          <PlacePicker current={place} options={places.filter((p) => p.active && fits(p, "produce"))} canSwitch={member.role === "admin"} />
        </div>
      </div>
      <p className="lead">
        Ne kadar ürettiğini gir ve kaydet. Tarifteki malzemeler {place.name} stoğundan düşer; ürünler satışa hazır olarak
        ortak ürün havuzuna girer. Satış yerleri vitrinlerine havuzdan alır.
      </p>
      <ProductionForm key={place.id} products={products} withRecipe={withRecipe} today={todayTR()} placeId={place.id} />
    </>
  );
}
