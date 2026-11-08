export type Role = "owner" | "counter" | "kitchen" | "depot";
export type Sector = "bakery" | "bookstore" | "general";
export type MovementKind = "sale" | "waste" | "production" | "receipt" | "count";

export type Business = { id: string; name: string; sector: Sector; created_at: string };
export type Member = { user_id: string; business_id: string; role: Role; name: string; created_at: string };
export type Invite = { code: string; business_id: string; role: Role; expires_at: string; used_by: string | null; used_at: string | null; created_at: string };
export type Ingredient = { id: string; business_id: string; name: string; unit: string; stock: number; min_stock: number; active: boolean };
export type Product = {
  id: string; business_id: string; name: string; emoji: string | null; unit: string; price: number;
  stock: number; min_stock: number; barcode: string | null; active: boolean; sort: number;
};
export type RecipeItem = { product_id: string; ingredient_id: string; qty: number };
export type Movement = { id: string; business_id: string; kind: MovementKind; created_by_name: string | null; total: number; note: string | null; created_at: string };
export type MovementLine = { movement_id: string; product_id: string | null; ingredient_id: string | null; qty: number; unit_price: number | null };

export const ROLE_LABEL: Record<Role, string> = { owner: "Patron", counter: "Tezgâh", kitchen: "Mutfak", depot: "Depo" };
export const ROLE_HINT: Record<Role, string> = {
  owner: "Her şeyi görür, ürün ve ekip yönetir",
  counter: "Satış ve fire girer",
  kitchen: "Üretim girer, malzeme kabul eder",
  depot: "Mal kabul ve sayım yapar",
};
export const SECTOR_LABEL: Record<Sector, string> = { bakery: "Pastane / fırın", bookstore: "Kitapçı", general: "Diğer dükkân" };
export const KIND_LABEL: Record<MovementKind, string> = { sale: "Satış", waste: "Fire", production: "Üretim", receipt: "Mal geldi", count: "Sayım" };
export const PRODUCT_UNITS = ["adet", "dilim", "porsiyon", "paket", "bütün", "kg"] as const;
export const INGREDIENT_UNITS = ["kg", "g", "L", "ml", "adet", "paket"] as const;

/** Screens each role can open, in tab order. The first one is the role's home. */
export const ROLE_TABS: Record<Role, { href: string; label: string }[]> = {
  owner: [
    { href: "/app/today", label: "Bugün" },
    { href: "/app/sales", label: "Satış" },
    { href: "/app/production", label: "Üretim" },
    { href: "/app/ingredients", label: "Malzeme" },
    { href: "/app/catalog", label: "Ürünler" },
    { href: "/app/team", label: "Ekip" },
    { href: "/app/movements", label: "Hareketler" },
  ],
  counter: [{ href: "/app/sales", label: "Satış" }],
  kitchen: [
    { href: "/app/production", label: "Üretim" },
    { href: "/app/ingredients", label: "Malzeme" },
  ],
  depot: [{ href: "/app/ingredients", label: "Malzeme" }],
};

export const tl = (n: number) => "₺" + new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
export const num = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(n);

/** Start of "today" in Türkiye (UTC+3, no DST) as an ISO timestamp. */
export function startOfTodayTR(now = new Date()): string {
  const tr = new Date(now.getTime() + 3 * 3600_000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - 3 * 3600_000).toISOString();
}
