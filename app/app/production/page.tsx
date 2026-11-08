import type { Metadata } from "next";
import { ProductionForm } from "@/components/ProductionForm";
import { requireMember } from "@/lib/session";
import type { Product, RecipeItem } from "@/lib/types";

export const metadata: Metadata = { title: "Üretim" };

export default async function ProductionPage() {
  const { supabase } = await requireMember(["owner", "kitchen"]);
  const [{ data: products }, { data: recipe }] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("sort").order("name"),
    supabase.from("recipe_items").select("product_id, ingredient_id, qty"),
  ]);
  const withRecipe = [...new Set(((recipe ?? []) as RecipeItem[]).map((r) => r.product_id))];
  return (
    <main className="wrap">
      <h2>Bugün ne ürettin?</h2>
      <p className="sub">Adetleri gir, kaydet. Tarifteki malzemeler stoktan kendiliğinden düşer.</p>
      <ProductionForm products={(products ?? []) as Product[]} withRecipe={withRecipe} />
    </main>
  );
}
