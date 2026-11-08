export type Role = "admin" | "employee";
export type Sector = "bakery" | "bookstore" | "general";
export type MovementKind = "sale" | "waste" | "production" | "receipt" | "count" | "restock";

export type Business = { id: string; name: string; sector: Sector; created_at: string };
export type Member = { user_id: string; business_id: string; role: Role; name: string; location_id: string | null; created_at: string };
export type Invite = {
  code: string; business_id: string; role: Role; location_id: string | null; email: string | null; name: string | null;
  expires_at: string; used_by: string | null; used_at: string | null; created_at: string;
};
/** A branch of the business. It produces (into the shared pool), sells (from its own shelf), or both. */
export type Place = {
  id: string; business_id: string; name: string; address: string | null; can_produce: boolean; can_sell: boolean;
  active: boolean; created_at: string;
};
export type Ingredient = { id: string; business_id: string; name: string; unit: string; min_stock: number; active: boolean };
export type Product = {
  id: string; business_id: string; name: string; emoji: string | null; unit: string; price: number;
  min_stock: number; barcode: string | null; active: boolean; sort: number; weight_g: number | null;
  category: string | null; made_to_order: boolean;
};
/** A catalog item together with how much of it one place has. */
export type Stocked<T> = T & { stock: number };
export type StockRow = { location_id: string; qty: number };
export type RecipeItem = { product_id: string; ingredient_id: string; qty: number };
export type Movement = {
  id: string; business_id: string; location_id: string | null; kind: MovementKind; created_by_name: string | null; total: number;
  note: string | null; created_at: string; occurred_on: string;
};
export type MovementLine = {
  movement_id: string; product_id: string | null; ingredient_id: string | null; qty: number;
  unit_price: number | null; expires_on: string | null; weight_g: number | null;
};
export type ExpiringBatch = { location_id: string | null; product_id: string | null; ingredient_id: string | null; qty: number; expires_on: string; occurred_on: string };

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", employee: "Çalışan" };
export const SECTOR_LABEL: Record<Sector, string> = { bakery: "Pastane / fırın", bookstore: "Kitapçı", general: "Diğer dükkân" };
export const KIND_LABEL: Record<MovementKind, string> = {
  sale: "Satış", waste: "Fire", production: "Üretim", receipt: "Mal geldi", count: "Sayım",
  restock: "Havuzdan alındı",
};
export const PRODUCT_UNITS = ["adet", "dilim", "porsiyon", "paket", "bütün", "kg", "bardak", "şişe"] as const;
export const INGREDIENT_UNITS = ["kg", "g", "L", "ml", "adet", "paket"] as const;

export type NavItem = { href: string; label: string; icon: IconName };
export type IconName = "overview" | "sales" | "production" | "pool" | "stock" | "catalog" | "places" | "team" | "movements";

export const tl = (n: number) => "₺" + new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
export const num = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(n);
