import type { Metadata } from "next";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { requireMember } from "@/lib/session";
import { INGREDIENT_UNITS, PRODUCT_UNITS, num, tl, type Ingredient, type Product, type RecipeItem } from "@/lib/types";
import { countProduct, loadSampleData, saveIngredient, saveProduct, saveRecipeItem, setProductActive } from "../_actions/catalog";

export const metadata: Metadata = { title: "Ürünler" };

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, business } = await requireMember(["owner"]);
  const sp = await searchParams;
  const [{ data: p }, { data: g }, { data: r }] = await Promise.all([
    supabase.from("products").select("*").order("active", { ascending: false }).order("sort").order("name"),
    supabase.from("ingredients").select("*").order("name"),
    supabase.from("recipe_items").select("*"),
  ]);
  const products = (p ?? []) as Product[];
  const ingredients = (g ?? []) as Ingredient[];
  const recipe = (r ?? []) as RecipeItem[];
  const ing = new Map(ingredients.map((x) => [x.id, x]));
  const empty = !products.length && !ingredients.length;

  return (
    <main className="wrap">
      {param(sp.welcome) && <Alert info={`${business.name} hazır! Önce ürünlerini ve malzemelerini ekle.`} />}
      <Alert error={param(sp.error)} info={param(sp.ok)} />

      {empty && (
        <div className="card">
          <h3>Hızlı başlangıç</h3>
          <p className="hint" style={{ marginTop: 0 }}>Örnek bir pastanenin ürünlerini, malzemelerini ve tariflerini yükle; sonra kendine göre düzenle.</p>
          <form action={loadSampleData}><button className="btn block" type="submit">Örnek pastane verilerini yükle</button></form>
        </div>
      )}

      <h2>Ürünler</h2>
      <p className="sub">Vitrinde satılanlar. Bir ürüne dokun; fiyatını, tarifini ve vitrin sayımını düzenle.</p>
      <div className="card">
        {!products.length && <div className="empty">Henüz ürün yok.</div>}
        {products.map((x) => {
          const lines = recipe.filter((l) => l.product_id === x.id);
          return (
            <details key={x.id} className="row" style={{ display: "block", opacity: x.active ? 1 : 0.55 }}>
              <summary style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", listStyle: "none" }}>
                <span className="em" aria-hidden="true">{x.emoji || "📦"}</span>
                <span className="mid">
                  <b>{x.name}{x.active ? "" : " (satışta değil)"}</b>
                  <small>{tl(Number(x.price))} / {x.unit} · vitrinde {num(Number(x.stock))}{lines.length ? "" : " · tarif yok"}</small>
                </span>
              </summary>
              <div style={{ padding: "12px 0 4px" }}>
                <form action={saveProduct}>
                  <input type="hidden" name="id" value={x.id} />
                  <ProductFields p={x} />
                  <button className="btn small" type="submit">Kaydet</button>
                </form>

                <h3 style={{ marginTop: 18 }}>Tarif (1 {x.unit} için)</h3>
                {lines.map((l) => {
                  const gi = ing.get(l.ingredient_id);
                  return (
                    <form key={l.ingredient_id} action={saveRecipeItem} className="inline" style={{ alignItems: "center", marginBottom: 6 }}>
                      <input type="hidden" name="product_id" value={x.id} />
                      <input type="hidden" name="ingredient_id" value={l.ingredient_id} />
                      <span style={{ flex: "2 1 120px" }}>{gi?.name ?? "?"}</span>
                      <input name="qty" type="number" inputMode="decimal" step="any" min={0} defaultValue={Number(l.qty)} aria-label={`${gi?.name} miktarı (${gi?.unit})`} />
                      <span className="hint" style={{ flex: "0 0 36px" }}>{gi?.unit}</span>
                      <button className="btn small ghost" type="submit" style={{ flex: "0 0 auto" }}>Güncelle</button>
                    </form>
                  );
                })}
                <p className="hint" style={{ margin: "4px 0 8px" }}>Bir malzemeyi tariften çıkarmak için miktarını 0 yapıp güncelle.</p>
                {ingredients.length > 0 && (
                  <form action={saveRecipeItem} className="inline" style={{ alignItems: "center" }}>
                    <input type="hidden" name="product_id" value={x.id} />
                    <select name="ingredient_id" aria-label="Eklenecek malzeme" defaultValue="" style={{ flex: "2 1 140px" }}>
                      <option value="" disabled>Malzeme seç</option>
                      {ingredients.filter((gi) => gi.active && !lines.some((l) => l.ingredient_id === gi.id)).map((gi) => (
                        <option key={gi.id} value={gi.id}>{gi.name} ({gi.unit})</option>
                      ))}
                    </select>
                    <input name="qty" type="number" inputMode="decimal" step="any" min={0} placeholder="Miktar" aria-label="Miktar" />
                    <button className="btn small" type="submit" style={{ flex: "0 0 auto" }}>Ekle</button>
                  </form>
                )}

                <h3 style={{ marginTop: 18 }}>Vitrin sayımı</h3>
                <form action={countProduct} className="inline" style={{ alignItems: "center" }}>
                  <input type="hidden" name="id" value={x.id} />
                  <input name="counted" type="number" inputMode="decimal" step="any" min={0} placeholder={`Vitrinde sayılan (${x.unit})`} aria-label="Vitrinde sayılan" />
                  <button className="btn small ghost" type="submit" style={{ flex: "0 0 auto" }}>Kaydet</button>
                </form>

                <form action={setProductActive} style={{ marginTop: 14 }}>
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="active" value={x.active ? "0" : "1"} />
                  <button className="btn small ghost" type="submit">{x.active ? "Satıştan kaldır" : "Tekrar satışa aç"}</button>
                </form>
              </div>
            </details>
          );
        })}
      </div>
      <details className="card">
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>+ Yeni ürün ekle</summary>
        <form action={saveProduct} style={{ marginTop: 12 }}>
          <ProductFields />
          <div className="field">
            <label htmlFor="np-stock">Şu an vitrinde kaç tane var?</label>
            <input id="np-stock" name="stock" type="number" inputMode="decimal" step="any" min={0} defaultValue={0} />
          </div>
          <button className="btn block" type="submit">Ürünü ekle</button>
        </form>
      </details>

      <h2 id="ingredients" style={{ marginTop: 24 }}>Malzemeler</h2>
      <p className="sub">Tariflerde kullanılan ve mal olarak gelenler. &quot;En az&quot; miktarın altına düşünce uyarı çıkar.</p>
      <div className="card">
        {!ingredients.length && <div className="empty">Henüz malzeme yok.</div>}
        {ingredients.map((x) => (
          <details key={x.id} className="row" style={{ display: "block" }}>
            <summary style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", listStyle: "none" }}>
              <span className="mid"><b>{x.name}</b><small>en az {num(Number(x.min_stock))} {x.unit}</small></span>
              <span className="qty">{num(Number(x.stock))} {x.unit}</span>
            </summary>
            <form action={saveIngredient} style={{ paddingTop: 12 }}>
              <input type="hidden" name="id" value={x.id} />
              <IngredientFields g={x} />
              <button className="btn small" type="submit">Kaydet</button>
            </form>
          </details>
        ))}
      </div>
      <details className="card">
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>+ Yeni malzeme ekle</summary>
        <form action={saveIngredient} style={{ marginTop: 12 }}>
          <IngredientFields />
          <div className="field">
            <label htmlFor="ng-stock">Şu an elinde ne kadar var?</label>
            <input id="ng-stock" name="stock" type="number" inputMode="decimal" step="any" min={0} defaultValue={0} />
          </div>
          <button className="btn block" type="submit">Malzemeyi ekle</button>
        </form>
      </details>
    </main>
  );
}

function ProductFields({ p }: { p?: Product }) {
  const id = p?.id ?? "new";
  return (
    <>
      <div className="inline">
        <div className="field" style={{ flex: "0 0 76px" }}>
          <label htmlFor={`emoji-${id}`}>Simge</label>
          <input id={`emoji-${id}`} name="emoji" type="text" maxLength={16} defaultValue={p?.emoji ?? ""} placeholder="🍰" style={{ textAlign: "center" }} />
        </div>
        <div className="field" style={{ flex: "1 1 200px" }}>
          <label htmlFor={`name-${id}`}>Ürün adı</label>
          <input id={`name-${id}`} name="name" type="text" required maxLength={60} defaultValue={p?.name ?? ""} />
        </div>
      </div>
      <div className="inline">
        <div className="field">
          <label htmlFor={`price-${id}`}>Fiyat (₺)</label>
          <input id={`price-${id}`} name="price" type="number" inputMode="decimal" step="any" min={0} required defaultValue={p ? Number(p.price) : ""} />
        </div>
        <div className="field">
          <label htmlFor={`unit-${id}`}>Birim</label>
          <select id={`unit-${id}`} name="unit" defaultValue={p?.unit ?? "adet"}>
            {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`min-${id}`}>Vitrinde en az</label>
          <input id={`min-${id}`} name="min_stock" type="number" inputMode="decimal" step="any" min={0} defaultValue={p ? Number(p.min_stock) : 0} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`barcode-${id}`}>Barkod <span className="hint">(isteğe bağlı)</span></label>
        <input id={`barcode-${id}`} name="barcode" type="text" inputMode="numeric" maxLength={32} defaultValue={p?.barcode ?? ""} />
      </div>
    </>
  );
}

function IngredientFields({ g }: { g?: Ingredient }) {
  const id = g?.id ?? "new";
  return (
    <div className="inline">
      <div className="field" style={{ flex: "2 1 180px" }}>
        <label htmlFor={`gname-${id}`}>Malzeme adı</label>
        <input id={`gname-${id}`} name="name" type="text" required maxLength={60} defaultValue={g?.name ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`gunit-${id}`}>Birim</label>
        <select id={`gunit-${id}`} name="unit" defaultValue={g?.unit ?? "kg"}>
          {INGREDIENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`gmin-${id}`}>En az</label>
        <input id={`gmin-${id}`} name="min_stock" type="number" inputMode="decimal" step="any" min={0} defaultValue={g ? Number(g.min_stock) : 0} />
      </div>
    </div>
  );
}
