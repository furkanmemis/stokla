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
const grams = (v: number) => (v >= 1 && v <= 100_000 ? Math.round(v) : null);

function refresh() {
  revalidatePath("/app", "layout");
}

export async function saveProduct(fd: FormData) {
  const { supabase, business } = await requireMember(["admin"]);
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
    weight_g: grams(decimal(fd, "weight_g")),
    category: text(fd, "category", 40) || null,
    made_to_order: fd.get("made_to_order") === "on",
  };
  const { error } = id
    ? await supabase.from("products").update(row).eq("id", id)
    : await supabase.from("products").insert({ ...row, business_id: business.id });
  if (error) redirectWith(PAGE, "error", error.code === UNIQUE_VIOLATION ? "Bu adda ya da barkodda bir ürün zaten var." : "Ürün kaydedilemedi.");
  refresh();
  redirectWith(PAGE, "ok", id ? "Ürün güncellendi." : "Ürün eklendi.");
}

export async function setProductActive(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const { error } = await supabase.from("products").update({ active: text(fd, "active") === "1" }).eq("id", text(fd, "id", 40));
  if (error) redirectWith(PAGE, "error", "Ürün güncellenemedi.");
  refresh();
}

export async function saveIngredient(fd: FormData) {
  const { supabase, business } = await requireMember(["admin"]);
  const back = `${PAGE}#ingredients`;
  const id = text(fd, "id", 40);
  const name = text(fd, "name", 60);
  const unit = text(fd, "unit", 10);
  if (!name) redirectWith(back, "error", "Malzemenin adını yaz.");
  if (!isOneOf(INGREDIENT_UNITS, unit)) redirectWith(back, "error", "Birim seç.");

  const row = { name, unit, min_stock: nonNegative(decimal(fd, "min_stock")) };
  const { error } = id
    ? await supabase.from("ingredients").update(row).eq("id", id)
    : await supabase.from("ingredients").insert({ ...row, business_id: business.id });
  if (error) redirectWith(back, "error", error.code === UNIQUE_VIOLATION ? "Bu adda bir malzeme zaten var." : "Malzeme kaydedilemedi.");
  refresh();
  redirectWith(back, "ok", id ? "Malzeme güncellendi." : "Malzeme eklendi.");
}

/** Adds or changes one ingredient line of a product's recipe; an amount of 0 removes it. */
export async function saveRecipeItem(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
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
  const { supabase, business } = await requireMember(["admin"]);
  const [{ count: products }, { count: ingredients }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("ingredients").select("id", { count: "exact", head: true }),
  ]);
  if ((products ?? 0) > 0 || (ingredients ?? 0) > 0) redirectWith(PAGE, "error", "Örnek veriler sadece boş bir dükkâna yüklenebilir.");

  const { data: ings, error: e1 } = await supabase
    .from("ingredients")
    .insert(SAMPLE_BAKERY.ingredients.map(({ stock: _stock, ...g }) => ({ ...g, business_id: business.id })))
    .select("id, name");
  if (e1 || !ings) redirectWith(PAGE, "error", "Örnek malzemeler yüklenemedi.");

  const { data: prods, error: e2 } = await supabase
    .from("products")
    .insert(SAMPLE_BAKERY.products.map(({ recipe: _recipe, stock: _stock, ...p }, i) => ({ ...p, sort: i, business_id: business.id })))
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

  // A business needs at least one place to work at; start with one that makes and sells, holding the
  // sample amounts as its opening count (counts go through the database functions like any other change).
  let note = "";
  const { count: placeCount } = await supabase.from("locations").select("id", { count: "exact", head: true });
  if (!placeCount) {
    const { data: placeId, error: e4 } = await supabase.rpc("save_place", {
      p_id: null, p_name: "Merkez", p_can_produce: true, p_can_sell: true, p_address: null,
    });
    if (!e4 && typeof placeId === "string") {
      await Promise.all([
        ...SAMPLE_BAKERY.ingredients.map((g) =>
          supabase.rpc("count_ingredient", { p_place: placeId, p_ingredient: ingredientId.get(g.name), p_counted: g.stock })),
        ...SAMPLE_BAKERY.products.map((p) =>
          supabase.rpc("count_product", { p_place: placeId, p_product: productId.get(p.name), p_counted: p.stock })),
      ]);
      note = " \"Merkez\" adında, hem üreten hem satan bir yer de açıldı.";
    }
  }
  refresh();
  redirectWith(PAGE, "ok", `Örnek pastane verileri yüklendi.${note} Fiyat ve tarifleri kendine göre düzenleyebilirsin.`);
}
