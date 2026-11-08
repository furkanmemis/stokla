"use server";

// Stock movements at one place. Each one is a single database function call, so stock and history
// change together; the database also checks the caller may act at that place.
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { dbMessage } from "@/lib/db";
import { sanitizeLines, sanitizeProductionLines, type ProductionLine, type StockLine } from "@/lib/domain/stock";
import { checkExpiry, checkMovementDay } from "@/lib/domain/dates";
import { redirectWith } from "@/lib/form";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BatchDates = { day?: string | null; expiresOn?: string | null };

const NETWORK_HINT = "Kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.";
const fail = (error: string): ActionResult => ({ ok: false, error });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (id: unknown): id is string => typeof id === "string" && UUID_RE.test(id);

async function done(error: { code?: string; message?: string } | null, fallback = NETWORK_HINT): Promise<ActionResult> {
  if (error) return fail(dbMessage(error, fallback));
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function recordSale(placeId: string, items: StockLine[], waste: boolean): Promise<ActionResult> {
  const { supabase } = await requireMember();
  const lines = sanitizeLines(items);
  if (!validId(placeId)) return fail("Yer seçilmedi.");
  if (!lines.length) return fail("Ürün seçilmedi.");
  const { error } = await supabase.rpc("record_sale", { p_place: placeId, p_items: lines, p_waste: waste === true });
  return done(error);
}

/** Production of one day; each line may carry its batch expiry date and unit weight in grams. */
export async function recordProduction(placeId: string, items: ProductionLine[], day?: string | null): Promise<ActionResult> {
  const { supabase } = await requireMember();
  if (!validId(placeId)) return fail("Yer seçilmedi.");
  const lines = sanitizeProductionLines(items);
  if (!lines.length) return fail("Adet girmedin.");
  const when = checkMovementDay(day);
  if (!when.ok) return fail(when.error);
  for (const l of lines) {
    const exp = checkExpiry(l.expires_on, when.day);
    if (!exp.ok) return fail(exp.error);
  }
  const { error } = await supabase.rpc("record_production", { p_place: placeId, p_items: lines, p_day: when.day });
  return done(error);
}

export async function receiveIngredient(placeId: string, id: string, qty: number, note?: string, dates: BatchDates = {}): Promise<ActionResult> {
  const { supabase } = await requireMember();
  if (!validId(placeId) || !validId(id)) return fail("Malzeme bulunamadı.");
  if (!(qty > 0)) return fail("Gelen miktarı yaz.");
  const when = checkMovementDay(dates.day);
  if (!when.ok) return fail(when.error);
  const exp = checkExpiry(dates.expiresOn, when.day);
  if (!exp.ok) return fail(exp.error);
  const { error } = await supabase.rpc("receive_ingredient", {
    p_place: placeId, p_ingredient: id, p_qty: qty, p_note: note?.slice(0, 300) || null, p_day: when.day, p_expires: exp.expiresOn,
  });
  return done(error);
}

export async function countIngredient(placeId: string, id: string, counted: number): Promise<ActionResult> {
  const { supabase } = await requireMember(["admin"]);
  if (!(counted >= 0)) return fail("Sayılan miktarı yaz.");
  const { error } = await supabase.rpc("count_ingredient", { p_place: placeId, p_ingredient: id, p_counted: counted });
  return done(error);
}

export async function countProduct(placeId: string, id: string, counted: number): Promise<ActionResult> {
  const { supabase } = await requireMember(["admin"]);
  if (!(counted >= 0)) return fail("Sayılan adedi yaz.");
  const { error } = await supabase.rpc("count_product", { p_place: placeId, p_product: id, p_counted: counted });
  return done(error);
}

// ---------------------------------------------------------------- pool

/** A selling place takes products from the shared pool onto its own shelf. */
export async function takeFromPool(placeId: string, items: StockLine[]): Promise<ActionResult> {
  const { supabase } = await requireMember();
  if (!validId(placeId)) return fail("Yer seçilmedi.");
  const lines = sanitizeLines(items);
  if (!lines.length) return fail("Havuzdan alınacak ürün seçmedin.");
  const { error } = await supabase.rpc("take_from_pool", { p_place: placeId, p_items: lines });
  return done(error);
}

export async function countPool(id: string, counted: number): Promise<ActionResult> {
  const { supabase } = await requireMember(["admin"]);
  if (!validId(id)) return fail("Ürün bulunamadı.");
  if (!(counted >= 0)) return fail("Sayılan adedi yaz.");
  const { error } = await supabase.rpc("count_pool", { p_product: id, p_counted: counted });
  return done(error);
}

/** Form version of countPool for the pool page. */
export async function countPoolForm(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const counted = Number(String(fd.get("counted") ?? "").replace(",", "."));
  const r = await countPool(id, String(fd.get("counted") ?? "").trim() === "" ? NaN : counted);
  redirectWith("/app/pool", r.ok ? "ok" : "error", r.ok ? "Havuz sayımı kaydedildi." : r.error);
}
