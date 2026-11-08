import type { Metadata } from "next";
import { PlacePicker } from "@/components/PlacePicker";
import { SaleScreen } from "@/components/SaleScreen";
import { requirePlace } from "@/lib/session";
import { productsAt } from "@/lib/queries";
import { fits } from "@/lib/domain/places";

export const metadata: Metadata = { title: "Satış" };

export default async function SalesPage() {
  const { supabase, member, place, places } = await requirePlace("sell");
  const products = await productsAt(supabase, place.id);
  const picker = <PlacePicker current={place} options={places.filter((p) => p.active && fits(p, "sell"))} canSwitch={member.role === "admin"} />;
  return <SaleScreen key={place.id} products={products} placeId={place.id} picker={picker} />;
}
