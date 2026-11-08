// Read helpers shared by pages: catalog items together with one place's stock.
import type { createClient } from "./supabase/server";
import { attachStock } from "./domain/stock";
import type { Ingredient, Product, Stocked } from "./types";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Active products, ordered for the counter, each with how many the place has. */
export async function productsAt(supabase: Db, placeId: string, opts: { madeToOrder?: boolean } = {}):
  Promise<Stocked<Product>[]> {
  let q = supabase.from("products").select("*").eq("active", true).order("sort").order("name");
  if (opts.madeToOrder === false) q = q.eq("made_to_order", false);
  const [{ data: products }, { data: rows }] = await Promise.all([
    q,
    supabase.from("stock_products").select("product_id, qty").eq("location_id", placeId),
  ]);
  return attachStock((products ?? []) as Product[],
    ((rows ?? []) as { product_id: string; qty: number }[]).map((r) => ({ id: r.product_id, qty: r.qty })));
}

/** Active ingredients, each with how much the place has. */
export async function ingredientsAt(supabase: Db, placeId: string): Promise<Stocked<Ingredient>[]> {
  const [{ data: ingredients }, { data: rows }] = await Promise.all([
    supabase.from("ingredients").select("*").eq("active", true).order("name"),
    supabase.from("stock_ingredients").select("ingredient_id, qty").eq("location_id", placeId),
  ]);
  return attachStock((ingredients ?? []) as Ingredient[],
    ((rows ?? []) as { ingredient_id: string; qty: number }[]).map((r) => ({ id: r.ingredient_id, qty: r.qty })));
}
