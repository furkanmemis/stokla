"use server";

// Owner-only catalog management: products, ingredients, recipes and the sample bakery.
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { dbMessage } from "@/lib/db";
import { decimal, redirectWith, text } from "@/lib/form";
import { SAMPLE_BAKERY } from "@/lib/sample";
import { INGREDIENT_UNITS, PRODUCT_UNITS } from "@/lib/types";

const PAGE = "/app/catalog";
const UNIQUE_VIOLATION = "23505";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);
const nonNegative = (v: number) => (v >= 0 ? v : 0);

function refresh() {
  revalidatePath("/app", "layout");
}

export async function saveProduct(fd: FormData) {
  const { supabase, business } = await requireMember(["owner"]);
  const id = text(fd, "id", 40);
  const name = text(fd, "name", 60);
  const unit = text(fd, "unit", 20);
  const price = decimal(fd, "price");
  if (!name) redirectWith(PAGE, "error", "Ürünün adını yaz.");
  if (!isOneOf(PRODUCT_UNITS, unit)) redirectWith(PAGE, "error", "Birim seç.");
  if (!(price >= 0)) redirectWith(PAGE, "error", "Fiyatı kontrol et.");

  const row = {
    name,
    unit,
    price,
    emoji: text(fd, "emoji", 16) || null,
    min_stock: nonNegative(decimal(fd, "min_stock")),
    barcode: text(fd, "barcode", 32).replace(/\s/g, "") || null,
  };
  const { error } = id
    ? await supabase.from("products").update(row).eq("id", id)
    : await supabase.from("products").insert({ ...row, business_id: business.id, stock: nonNegative(decimal(fd, "stock")) });
  if (error) redirectWith(PAGE, "error", error.code === UNIQUE_VIOLATION ? "Bu adda ya da barkodda bir ürün zaten var." : "Ürün kaydedilemedi.");
  refresh();
  redirectWith(PAGE, "ok", id ? "Ürün güncellendi." : "Ürün eklendi.");
}

export async function setProductActive(fd: FormData) {
  const { supabase } = await requireMember(["owner"]);
  const { error } = await supabase.from("products").update({ active: text(fd, "active") === "1" }).eq("id", text(fd, "id", 40));
  if (error) redirectWith(PAGE, "error", "Ürün güncellenemedi.");
  refresh();
}

export async function countProduct(fd: FormData) {
  const { supabase } = await requireMember(["owner"]);
  const counted = decimal(fd, "counted");
  if (!(counted >= 0)) redirectWith(PAGE, "error", "Sayılan adedi yaz.");
  const { error } = await supabase.rpc("count_product", { p_product: text(fd, "id", 40), p_counted: counted });
  if (error) redirectWith(PAGE, "error", dbMessage(error, "Sayım kaydedilemedi."));
  refresh();
  redirectWith(PAGE, "ok", "Vitrin sayımı kaydedildi.");
}

export async function saveIngredient(fd: FormData) {
  const { supabase, business } = await requireMember(["owner"]);
  const back = `${PAGE}#ingredients`;
  const id = text(fd, "id", 40);
  const name = text(fd, "name", 60);
  const unit = text(fd, "unit", 10);
  if (!name) redirectWith(back, "error", "Malzemenin adını yaz.");
  if (!isOneOf(INGREDIENT_UNITS, unit)) redirectWith(back, "error", "Birim seç.");

  const row = { name, unit, min_stock: nonNegative(decimal(fd, "min_stock")) };
  const { error } = id
    ? await supabase.from("ingredients").update(row).eq("id", id)
    : await supabase.from("ingredients").insert({ ...row, business_id: business.id, stock: nonNegative(decimal(fd, "stock")) });
  if (error) redirectWith(back, "error", error.code === UNIQUE_VIOLATION ? "Bu adda bir malzeme zaten var." : "Malzeme kaydedilemedi.");
  refresh();
  redirectWith(back, "ok", id ? "Malzeme güncellendi." : "Malzeme eklendi.");
}

/** Adds or changes one ingredient line of a product's recipe; an amount of 0 removes it. */
export async function saveRecipeItem(fd: FormData) {
  const { supabase } = await requireMember(["owner"]);
  const product_id = text(fd, "product_id", 40);
  const ingredient_id = text(fd, "ingredient_id", 40);
  const qty = decimal(fd, "qty");
  if (!ingredient_id) redirectWith(PAGE, "error", "Malzeme seç.");
  const { error } = qty > 0
    ? await supabase.from("recipe_items").upsert({ product_id, ingredient_id, qty })
    : await supabase.from("recipe_items").delete().eq("product_id", product_id).eq("ingredient_id", ingredient_id);
  if (error) redirectWith(PAGE, "error", "Tarif kaydedilemedi.");
  refresh();
  redirectWith(PAGE, "ok", "Tarif güncellendi.");
}

/** Fills an empty business with a sample bakery so the owner can try every screen right away. */
export async function loadSampleData() {
  const { supabase, business } = await requireMember(["owner"]);
  const [{ count: products }, { count: ingredients }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("ingredients").select("id", { count: "exact", head: true }),
  ]);
  if ((products ?? 0) > 0 || (ingredients ?? 0) > 0) redirectWith(PAGE, "error", "Örnek veriler sadece boş bir dükkâna yüklenebilir.");

  const { data: ings, error: e1 } = await supabase
    .from("ingredients")
    .insert(SAMPLE_BAKERY.ingredients.map((g) => ({ ...g, business_id: business.id })))
    .select("id, name");
  if (e1 || !ings) redirectWith(PAGE, "error", "Örnek malzemeler yüklenemedi.");

  const { data: prods, error: e2 } = await supabase
    .from("products")
    .insert(SAMPLE_BAKERY.products.map(({ recipe: _recipe, ...p }, i) => ({ ...p, sort: i, business_id: business.id })))
    .select("id, name");
  if (e2 || !prods) redirectWith(PAGE, "error", "Örnek ürünler yüklenemedi.");

  const ingredientId = new Map(ings.map((g) => [g.name as string, g.id as string]));
  const productId = new Map(prods.map((p) => [p.name as string, p.id as string]));
  const recipe = SAMPLE_BAKERY.products.flatMap((p) =>
    Object.entries(p.recipe).map(([ingredient, qty]) => ({
      product_id: productId.get(p.name)!,
      ingredient_id: ingredientId.get(ingredient)!,
      qty,
    })),
  );
  const { error: e3 } = await supabase.from("recipe_items").insert(recipe);
  if (e3) redirectWith(PAGE, "error", "Örnek tarifler yüklenemedi.");

  refresh();
  redirectWith(PAGE, "ok", "Örnek pastane verileri yüklendi. Fiyat ve tarifleri kendine göre düzenleyebilirsin.");
}
