import type { Metadata } from "next";
import { SaleScreen } from "@/components/SaleScreen";
import { requireMember } from "@/lib/session";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Satış" };

export default async function SalesPage() {
  const { supabase } = await requireMember(["admin", "employee"]);
  const { data } = await supabase.from("products").select("*").eq("active", true).order("sort").order("name");
  return <SaleScreen products={(data ?? []) as Product[]} />;
}
