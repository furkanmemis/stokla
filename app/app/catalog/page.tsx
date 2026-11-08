import type { Metadata } from "next";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { requireMember } from "@/lib/session";
import { INGREDIENT_UNITS, PRODUCT_UNITS, num, tl, type Ingredient, type Product, type RecipeItem } from "@/lib/types";
import { OTHER_CATEGORY, categoriesOf } from "@/lib/domain/stock";
import { loadSampleData, saveIngredient, saveProduct, saveRecipeItem, setProductActive } from "../_actions/catalog";

export const metadata: Metadata = { title: "Ürünler ve tarifler" };

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, business } = await requireMember(["admin"]);
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
  const categories = categoriesOf(products);
  const groups = (categories.length ? categories : [null]).map((c) => ({
    title: c,
    items: c === null ? products : products.filter((x) => (x.category ?? OTHER_CATEGORY) === c),
  }));

  return (
    <>
      <div className="page-head"><h1>Ürünler ve tarifler</h1></div>
      {param(sp.welcome) && <Alert info={`${business.name} hazır. Önce ürünlerini ve malzemelerini ekle.`} />}
      <Alert error={param(sp.error)} info={param(sp.ok)} />

      {!products.length && !ingredients.length && (
        <section className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 280px" }}>
            <h2>Hızlı başlangıç</h2>
            <p className="lead">Örnek bir pastanenin ürünlerini, malzemelerini ve tariflerini yükle; sonra kendine göre düzenle.</p>
          </div>
          <form action={loadSampleData}><button className="btn" type="submit">Örnek pastane verilerini yükle</button></form>
        </section>
      )}

      <div className="row">
        <section className="panel wide" aria-labelledby="h-products">
          <div className="panel-head"><h2 id="h-products">Ürünler</h2></div>
          <p className="lead" style={{ marginBottom: 6 }}>Satılan ürünler. Fiyatını, gramajını ve tarifini düzenlemek için ürüne dokun.</p>
          {!products.length && <p className="empty">Henüz ürün yok.</p>}
          <datalist id="categories">{categories.filter((c) => c !== OTHER_CATEGORY).map((c) => <option key={c} value={c} />)}</datalist>
          {groups.map((group) => (
          <div key={group.title ?? "all"}>
          {group.title && <h3 style={{ margin: "18px 0 2px", fontSize: 14, color: "var(--muted)" }}>{group.title} ({group.items.length})</h3>}
          <ul className="list">
            {group.items.map((x) => {
              const lines = recipe.filter((l) => l.product_id === x.id);
              return (
                <li key={x.id} style={{ display: "block", opacity: x.active ? 1 : 0.6 }}>
                  <details className="edit">
                    <summary style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="grow" style={{ flex: 1, minWidth: 0 }}>
                        <b>{x.name}{x.active ? "" : " (satışta değil)"}</b>
                        <small className="lead" style={{ display: "block", fontSize: 13 }}>
                          {tl(Number(x.price))} / {x.unit}{x.weight_g ? `, ${x.weight_g} g` : ""}
                          {x.made_to_order ? ", siparişle" : ""}{lines.length ? "" : ", tarif yok"}
                        </small>
                      </span>
                      <span className="btn small quiet" aria-hidden="true">Düzenle</span>
                    </summary>
                    <form action={saveProduct}>
                      <input type="hidden" name="id" value={x.id} />
                      <ProductFields p={x} />
                      <button className="btn small" type="submit">Kaydet</button>
                    </form>

                    <h3 style={{ margin: "20px 0 8px", fontSize: 15 }}>Tarif (1 {x.unit} için)</h3>
                    {lines.map((l) => {
                      const gi = ing.get(l.ingredient_id);
                      return (
                        <form key={l.ingredient_id} action={saveRecipeItem} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                          <input type="hidden" name="product_id" value={x.id} />
                          <input type="hidden" name="ingredient_id" value={l.ingredient_id} />
                          <span style={{ flex: "1 1 120px", minWidth: 0 }}>{gi?.name ?? "?"}</span>
                          <input className="input" name="qty" type="number" inputMode="decimal" step="any" min={0} defaultValue={Number(l.qty)}
                            aria-label={`${gi?.name} miktarı (${gi?.unit})`} style={{ width: 110 }} />
                          <span className="lead" style={{ width: 34 }}>{gi?.unit}</span>
                          <button className="btn small quiet" type="submit">Güncelle</button>
                        </form>
                      );
                    })}
                    <p className="lead" style={{ fontSize: 13, margin: "4px 0 8px" }}>Bir malzemeyi tariften çıkarmak için miktarını 0 yapıp güncelle.</p>
                    {ingredients.length > 0 && (
                      <form action={saveRecipeItem} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <input type="hidden" name="product_id" value={x.id} />
                        <select className="input" name="ingredient_id" aria-label="Eklenecek malzeme" defaultValue="" style={{ flex: "2 1 160px", width: "auto" }}>
                          <option value="" disabled>Malzeme seç</option>
                          {ingredients.filter((gi) => gi.active && !lines.some((l) => l.ingredient_id === gi.id)).map((gi) => (
                            <option key={gi.id} value={gi.id}>{gi.name} ({gi.unit})</option>
                          ))}
                        </select>
                        <input className="input" name="qty" type="number" inputMode="decimal" step="any" min={0} placeholder="Miktar" aria-label="Miktar" style={{ flex: "1 1 100px", width: "auto" }} />
                        <button className="btn small" type="submit">Tarife ekle</button>
                      </form>
                    )}
                    <form action={setProductActive} style={{ marginTop: 16 }}>
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="active" value={x.active ? "0" : "1"} />
                      <button className="btn small secondary" type="submit">{x.active ? "Satıştan kaldır" : "Tekrar satışa aç"}</button>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
          </div>
          ))}
          <details className="edit" style={{ marginTop: 10, borderTop: "1px solid var(--sunken)", paddingTop: 14 }}>
            <summary><span className="btn small">Yeni ürün ekle</span></summary>
            <form action={saveProduct}>
              <ProductFields />
              <button className="btn" type="submit">Ürünü ekle</button>
            </form>
          </details>
        </section>

        <section className="panel" id="ingredients" aria-labelledby="h-ingredients">
          <h2 id="h-ingredients">Malzemeler</h2>
          <p className="lead" style={{ marginBottom: 6 }}>Tariflerde kullanılanlar. Bir yerde &quot;en az&quot; miktarın altına düşünce uyarı çıkar. Her yerin stoğu Stok ekranında.</p>
          {!ingredients.length && <p className="empty">Henüz malzeme yok.</p>}
          <ul className="list">
            {ingredients.map((x) => (
              <li key={x.id} style={{ display: "block" }}>
                <details className="edit">
                  <summary style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{x.name}</b><small className="lead" style={{ display: "block", fontSize: 13 }}>En az {num(Number(x.min_stock))} {x.unit}</small></span>
                    <span className="lead">{x.unit}</span>
                  </summary>
                  <form action={saveIngredient}>
                    <input type="hidden" name="id" value={x.id} />
                    <IngredientFields g={x} />
                    <button className="btn small" type="submit">Kaydet</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
          <details className="edit" style={{ marginTop: 10, borderTop: "1px solid var(--sunken)", paddingTop: 14 }}>
            <summary><span className="btn small">Yeni malzeme ekle</span></summary>
            <form action={saveIngredient}>
              <IngredientFields />
              <button className="btn" type="submit">Malzemeyi ekle</button>
            </form>
          </details>
        </section>
      </div>
    </>
  );
}

function ProductFields({ p }: { p?: Product }) {
  const id = p?.id ?? "new";
  return (
    <div className="fields">
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label htmlFor={`name-${id}`}>Ürün adı</label>
        <input className="input" id={`name-${id}`} name="name" required maxLength={60} defaultValue={p?.name ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`price-${id}`}>Fiyat (₺)</label>
        <input className="input" id={`price-${id}`} name="price" type="number" inputMode="decimal" step="any" min={0} required defaultValue={p ? Number(p.price) : ""} />
      </div>
      <div className="field">
        <label htmlFor={`unit-${id}`}>Birim</label>
        <select className="input" id={`unit-${id}`} name="unit" defaultValue={p?.unit ?? "adet"}>
          {PRODUCT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`weight-${id}`}>Gramaj (g) <span className="hint">1 birim</span></label>
        <input className="input" id={`weight-${id}`} name="weight_g" type="number" inputMode="numeric" min={1} max={100000} defaultValue={p?.weight_g ?? ""} placeholder="Örn. 80" />
      </div>
      <div className="field">
        <label htmlFor={`min-${id}`}>Vitrinde en az</label>
        <input className="input" id={`min-${id}`} name="min_stock" type="number" inputMode="decimal" step="any" min={0} defaultValue={p ? Number(p.min_stock) : 0} />
      </div>
      <div className="field">
        <label htmlFor={`barcode-${id}`}>Barkod <span className="hint">isteğe bağlı</span></label>
        <input className="input" id={`barcode-${id}`} name="barcode" inputMode="numeric" maxLength={32} defaultValue={p?.barcode ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`category-${id}`}>Kategori <span className="hint">satış ekranında filtre</span></label>
        <input className="input" id={`category-${id}`} name="category" list="categories" maxLength={40} defaultValue={p?.category ?? ""} placeholder="Örn. Sıcak Kahveler" />
      </div>
      <label className="field" style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "flex-start", gap: 10, fontWeight: 600 }}>
        <input type="checkbox" name="made_to_order" defaultChecked={p?.made_to_order ?? false} style={{ width: 22, height: 22, marginTop: 1 }} />
        <span>Siparişle hazırlanır <span className="hint" style={{ display: "block" }}>Kahve, çay gibi. Vitrin stoğu tutulmaz; satılınca tarifteki malzemeler düşer.</span></span>
      </label>
    </div>
  );
}

function IngredientFields({ g }: { g?: Ingredient }) {
  const id = g?.id ?? "new";
  return (
    <div className="fields">
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label htmlFor={`gname-${id}`}>Malzeme adı</label>
        <input className="input" id={`gname-${id}`} name="name" required maxLength={60} defaultValue={g?.name ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`gunit-${id}`}>Birim</label>
        <select className="input" id={`gunit-${id}`} name="unit" defaultValue={g?.unit ?? "kg"}>
          {INGREDIENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`gmin-${id}`}>En az</label>
        <input className="input" id={`gmin-${id}`} name="min_stock" type="number" inputMode="decimal" step="any" min={0} defaultValue={g ? Number(g.min_stock) : 0} />
      </div>
    </div>
  );
}
