export type Role = "admin" | "employee";
export type Sector = "bakery" | "bookstore" | "general";
export type MovementKind = "sale" | "waste" | "production" | "receipt" | "count";

export type Business = { id: string; name: string; sector: Sector; created_at: string };
export type Member = { user_id: string; business_id: string; role: Role; name: string; created_at: string };
export type Invite = { code: string; business_id: string; role: Role; expires_at: string; used_by: string | null; used_at: string | null; created_at: string };
export type Ingredient = { id: string; business_id: string; name: string; unit: string; stock: number; min_stock: number; active: boolean };
export type Product = {
  id: string; business_id: string; name: string; emoji: string | null; unit: string; price: number;
  stock: number; min_stock: number; barcode: string | null; active: boolean; sort: number; weight_g: number | null;
  category: string | null; made_to_order: boolean;
};
export type RecipeItem = { product_id: string; ingredient_id: string; qty: number };
export type Movement = {
  id: string; business_id: string; kind: MovementKind; created_by_name: string | null; total: number;
  note: string | null; created_at: string; occurred_on: string;
};
export type MovementLine = {
  movement_id: string; product_id: string | null; ingredient_id: string | null; qty: number;
  unit_price: number | null; expires_on: string | null; weight_g: number | null;
};
export type ExpiringBatch = { product_id: string | null; ingredient_id: string | null; qty: number; expires_on: string; occurred_on: string };

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", employee: "Çalışan" };
export const SECTOR_LABEL: Record<Sector, string> = { bakery: "Pastane / fırın", bookstore: "Kitapçı", general: "Diğer dükkân" };
export const KIND_LABEL: Record<MovementKind, string> = { sale: "Satış", waste: "Fire", production: "Üretim", receipt: "Mal geldi", count: "Sayım" };
export const PRODUCT_UNITS = ["adet", "dilim", "porsiyon", "paket", "bütün", "kg", "bardak", "şişe"] as const;
export const INGREDIENT_UNITS = ["kg", "g", "L", "ml", "adet", "paket"] as const;

export type NavItem = { href: string; label: string; icon: IconName };
export type IconName = "overview" | "sales" | "production" | "stock" | "catalog" | "team" | "movements";

/** Screens each role can open, in menu order. The first one is the role's home. */
export const ROLE_NAV: Record<Role, NavItem[]> = {
  admin: [
    { href: "/app/overview", label: "Genel bakış", icon: "overview" },
    { href: "/app/sales", label: "Satış", icon: "sales" },
    { href: "/app/production", label: "Üretim", icon: "production" },
    { href: "/app/stock", label: "Stok", icon: "stock" },
    { href: "/app/catalog", label: "Ürünler ve tarifler", icon: "catalog" },
    { href: "/app/team", label: "Ekip", icon: "team" },
    { href: "/app/movements", label: "Hareketler", icon: "movements" },
  ],
  employee: [
    { href: "/app/sales", label: "Satış", icon: "sales" },
    { href: "/app/production", label: "Üretim", icon: "production" },
    { href: "/app/stock", label: "Stok", icon: "stock" },
  ],
};

export const tl = (n: number) => "₺" + new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
export const num = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(n);
