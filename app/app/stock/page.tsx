import type { Metadata } from "next";
import Link from "next/link";
import { param, type SearchParams } from "@/components/Alert";
import { PlacePicker } from "@/components/PlacePicker";
import { StockScreen } from "@/components/StockScreen";
import { requirePlace } from "@/lib/session";
import { ingredientsAt, productsAt } from "@/lib/queries";
import { todayTR } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Stok" };

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, member, place, places } = await requirePlace();
  // Only selling places keep products on a shelf; produced goods sit in the shared pool instead.
  const view = place.can_sell && param((await searchParams).view) === "products" ? "products" : "ingredients";
  const productsLabel = "Vitrin";
  const [ingredients, products, { data: receipts }] = await Promise.all([
    ingredientsAt(supabase, place.id),
    productsAt(supabase, place.id, { madeToOrder: false }),
    supabase.from("movements").select("occurred_on, movement_lines(ingredient_id)").eq("kind", "receipt").eq("location_id", place.id)
      .order("occurred_on", { ascending: false }).limit(300),
  ]);
  // Newest receipt day per ingredient at this place (rows come newest first).
  const lastReceipt: Record<string, string> = {};
  for (const m of (receipts ?? []) as { occurred_on: string; movement_lines: { ingredient_id: string | null }[] }[]) {
    for (const l of m.movement_lines) if (l.ingredient_id && !lastReceipt[l.ingredient_id]) lastReceipt[l.ingredient_id] = m.occurred_on;
  }

  return (
    <>
      <div className="page-head">
        <div className="head-title">
          <h1>Stok</h1>
          <PlacePicker current={place} options={places.filter((p) => p.active)} canSwitch={member.role === "admin"} />
        </div>
        {place.can_sell && (
          <nav className="seg" aria-label="Stok türü">
            <Link href="/app/stock" aria-current={view === "ingredients" ? "page" : undefined}>Malzemeler</Link>
            <Link href="/app/stock?view=products" aria-current={view === "products" ? "page" : undefined}>{productsLabel}</Link>
          </nav>
        )}
      </div>
      <p className="lead">
        {place.name} stoğu. Siyah çizgi en az olması gereken miktar.{" "}
        {view === "ingredients" ? "Mal gelince malzemeye dokun." : "Vitrine ürün, Ürün havuzu ekranından alınır."}
      </p>
      <StockScreen key={`${place.id}-${view}`} view={view} ingredients={ingredients} products={products} lastReceipt={lastReceipt}
        role={member.role} today={todayTR()} placeId={place.id} productsLabel={productsLabel} />
    </>
  );
}
