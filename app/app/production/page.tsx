import type { Metadata } from "next";
import { ProductionForm } from "@/components/ProductionForm";
import { requireMember } from "@/lib/session";
import { todayTR } from "@/lib/domain/dates";
import type { Product, RecipeItem } from "@/lib/types";

export const metadata: Metadata = { title: "Üretim" };

export default async function ProductionPage() {
  const { supabase } = await requireMember(["admin", "employee"]);
  const [{ data: products }, { data: recipe }] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("sort").order("name"),
    supabase.from("recipe_items").select("product_id"),
  ]);
  const withRecipe = [...new Set(((recipe ?? []) as Pick<RecipeItem, "product_id">[]).map((r) => r.product_id))];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Üretim</h1>
        </div>
      </div>
      <p className="lead">Ne kadar ürettiğini gir ve kaydet. Tarifteki malzemeler stoktan kendiliğinden düşer.</p>
      <ProductionForm products={(products ?? []) as Product[]} withRecipe={withRecipe} today={todayTR()} />
    </>
  );
}
