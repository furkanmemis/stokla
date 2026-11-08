import type { Metadata } from "next";
import Link from "next/link";
import { param, type SearchParams } from "@/components/Alert";
import { StockScreen } from "@/components/StockScreen";
import { requireMember } from "@/lib/session";
import { todayTR } from "@/lib/domain/dates";
import type { Ingredient, Product } from "@/lib/types";

export const metadata: Metadata = { title: "Stok" };

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, member } = await requireMember(["admin", "employee"]);
  const view = param((await searchParams).view) === "products" ? "products" : "ingredients";
  const [{ data: ings }, { data: prods }, { data: receipts }] = await Promise.all([
    supabase.from("ingredients").select("*").eq("active", true).order("name"),
    supabase.from("products").select("*").eq("active", true).eq("made_to_order", false).order("name"),
    supabase.from("movements").select("occurred_on, movement_lines(ingredient_id)").eq("kind", "receipt")
      .order("occurred_on", { ascending: false }).limit(300),
  ]);
  // Newest receipt day per ingredient (rows come newest first).
  const lastReceipt: Record<string, string> = {};
  for (const m of (receipts ?? []) as { occurred_on: string; movement_lines: { ingredient_id: string | null }[] }[]) {
    for (const l of m.movement_lines) if (l.ingredient_id && !lastReceipt[l.ingredient_id]) lastReceipt[l.ingredient_id] = m.occurred_on;
  }

  return (
    <>
      <div className="page-head">
        <h1>Stok</h1>
        <nav className="seg" aria-label="Stok türü">
          <Link href="/app/stock" aria-current={view === "ingredients" ? "page" : undefined}>Malzemeler</Link>
          <Link href="/app/stock?view=products" aria-current={view === "products" ? "page" : undefined}>Vitrin</Link>
        </nav>
      </div>
      <p className="lead">Siyah çizgi en az olması gereken miktar. {view === "ingredients" ? "Mal gelince malzemeye dokun." : "Vitrindeki ürün stokları."}</p>
      <StockScreen view={view} ingredients={(ings ?? []) as Ingredient[]} products={(prods ?? []) as Product[]}
        lastReceipt={lastReceipt} role={member.role} today={todayTR()} />
    </>
  );
}
