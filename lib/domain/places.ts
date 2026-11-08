// Rules about places (branches): what a place does, who works where, and which screens a person gets.
// Pure: the database enforces the same rules; these keep the screens honest and the messages early.
import type { NavItem, Place, Role } from "../types";

export type Need = "produce" | "sell" | null;
type PlaceLike = Pick<Place, "id" | "name" | "can_produce" | "can_sell" | "active">;

export const MAX_PLACE_NAME = 60;
export const MAX_ADDRESS = 160;

/** Short description of what a place does. */
export function placeKind(p: Pick<Place, "can_produce" | "can_sell">): string {
  if (p.can_produce && p.can_sell) return "Üretim ve satış";
  return p.can_produce ? "Üretim" : "Satış";
}

/** Whether a place can do what a screen needs. */
export function fits(p: Pick<Place, "can_produce" | "can_sell">, need: Need): boolean {
  if (need === "produce") return p.can_produce;
  if (need === "sell") return p.can_sell;
  return true;
}

export type PlaceInput = { name: string; address: string; canProduce: boolean; canSell: boolean };
export type CheckedPlace = { name: string; address: string | null; canProduce: boolean; canSell: boolean };

/** Validates the place form before it reaches the database (which checks the same rules). */
export function checkPlace(input: PlaceInput, places: PlaceLike[], editingId: string | null = null):
  { ok: true; value: CheckedPlace } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name || name.length > MAX_PLACE_NAME) return { ok: false, error: `Yer adı 1 ile ${MAX_PLACE_NAME} karakter arasında olmalı.` };
  const clash = places.some((p) => p.id !== editingId && p.name.trim().toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"));
  if (clash) return { ok: false, error: "Bu adda bir yer zaten var." };
  if (!input.canProduce && !input.canSell) return { ok: false, error: "Yer üretim ya da satış yapmalı (ya da ikisini birden)." };
  const address = input.address.trim().slice(0, MAX_ADDRESS) || null;
  return { ok: true, value: { name, address, canProduce: input.canProduce, canSell: input.canSell } };
}

export type Resolved<T> = { ok: true; place: T } | { ok: false; reason: "no-places" | "unassigned" | "cannot" };

/**
 * The place a screen works at. Employees always work at their own place; admins at the place they
 * last picked, or the first one that fits the screen.
 */
export function resolvePlace<T extends PlaceLike>(input: {
  role: Role; assignedId: string | null; chosenId: string | null; places: T[]; need: Need;
}): Resolved<T> {
  const { role, assignedId, chosenId, places, need } = input;
  const open = places.filter((p) => p.active);
  if (role === "employee") {
    const own = open.find((p) => p.id === assignedId);
    if (!own) return { ok: false, reason: "unassigned" };
    return fits(own, need) ? { ok: true, place: own } : { ok: false, reason: "cannot" };
  }
  const usable = open.filter((p) => fits(p, need));
  if (!usable.length) return { ok: false, reason: open.length ? "cannot" : "no-places" };
  return { ok: true, place: usable.find((p) => p.id === chosenId) ?? usable[0] };
}

const ITEM = {
  overview: { href: "/app/overview", label: "Genel bakış", icon: "overview" },
  sales: { href: "/app/sales", label: "Satış", icon: "sales" },
  production: { href: "/app/production", label: "Üretim", icon: "production" },
  pool: { href: "/app/pool", label: "Ürün havuzu", icon: "pool" },
  stock: { href: "/app/stock", label: "Stok", icon: "stock" },
  catalog: { href: "/app/catalog", label: "Ürünler ve tarifler", icon: "catalog" },
  places: { href: "/app/places", label: "Yerler", icon: "places" },
  team: { href: "/app/team", label: "Ekip", icon: "team" },
  movements: { href: "/app/movements", label: "Hareketler", icon: "movements" },
} satisfies Record<string, NavItem>;

export const WAITING_PATH = "/app/waiting";

/** Screens a person can open, in menu order; the first one is their home. Employees get what their place does. */
export function navFor(role: Role, place: Pick<Place, "can_produce" | "can_sell" | "active"> | null): NavItem[] {
  if (role === "admin") {
    return [ITEM.overview, ITEM.sales, ITEM.production, ITEM.pool, ITEM.stock, ITEM.catalog, ITEM.places, ITEM.team, ITEM.movements];
  }
  if (!place?.active) return [];
  return [
    ...(place.can_sell ? [ITEM.sales] : []),
    ...(place.can_produce ? [ITEM.production] : []),
    ITEM.pool,
    ITEM.stock,
  ];
}

export const homeFor = (role: Role, place: Pick<Place, "can_produce" | "can_sell" | "active"> | null) =>
  navFor(role, place)[0]?.href ?? WAITING_PATH;
