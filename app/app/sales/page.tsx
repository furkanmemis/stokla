import type { Metadata } from "next";
import { SaleGrid } from "@/components/SaleGrid";
import { requireMember } from "@/lib/session";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Satış" };

export default async function SalePage() {
  const { supabase } = await requireMember(["owner", "counter"]);
  const { data } = await supabase.from("products").select("*").eq("active", true).order("sort").order("name");
  return (
    <main className="wrap">
      <SaleGrid products={(data ?? []) as Product[]} />
    </main>
  );
}
