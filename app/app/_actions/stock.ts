"use server";

// Stock movements. Each one is a single database function call, so stock and history change together.
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { dbMessage } from "@/lib/db";
import { sanitizeLines, sanitizeProductionLines, type ProductionLine, type StockLine } from "@/lib/domain/stock";
import { checkExpiry, checkMovementDay } from "@/lib/domain/dates";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BatchDates = { day?: string | null; expiresOn?: string | null };

const NETWORK_HINT = "Kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.";
const fail = (error: string): ActionResult => ({ ok: false, error });

async function done(error: { code?: string; message?: string } | null, fallback = NETWORK_HINT): Promise<ActionResult> {
  if (error) return fail(dbMessage(error, fallback));
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function recordSale(items: StockLine[], waste: boolean): Promise<ActionResult> {
  const { supabase } = await requireMember(["admin", "employee"]);
  const lines = sanitizeLines(items);
  if (!lines.length) return fail("Ürün seçilmedi.");
  const { error } = await supabase.rpc("record_sale", { p_items: lines, p_waste: waste === true });
  return done(error);
}

/** Production of one day; each line may carry its batch expiry date and unit weight in grams. */
export async function recordProduction(items: ProductionLine[], day?: string | null): Promise<ActionResult> {
  const { supabase } = await requireMember(["admin", "employee"]);
  const lines = sanitizeProductionLines(items);
  if (!lines.length) return fail("Adet girmedin.");
  const when = checkMovementDay(day);
  if (!when.ok) return fail(when.error);
  for (const l of lines) {
    const exp = checkExpiry(l.expires_on, when.day);
    if (!exp.ok) return fail(exp.error);
  }
  const { error } = await supabase.rpc("record_production", { p_items: lines, p_day: when.day });
  return done(error);
}

export async function receiveIngredient(id: string, qty: number, note?: string, dates: BatchDates = {}): Promise<ActionResult> {
  const { supabase } = await requireMember(["admin", "employee"]);
  if (!(qty > 0)) return fail("Gelen miktarı yaz.");
  const when = checkMovementDay(dates.day);
  if (!when.ok) return fail(when.error);
  const exp = checkExpiry(dates.expiresOn, when.day);
  if (!exp.ok) return fail(exp.error);
  const { error } = await supabase.rpc("receive_ingredient", {
    p_ingredient: id, p_qty: qty, p_note: note?.slice(0, 300) || null, p_day: when.day, p_expires: exp.expiresOn,
  });
  return done(error);
}

export async function countIngredient(id: string, counted: number): Promise<ActionResult> {
  const { supabase } = await requireMember(["admin"]);
  if (!(counted >= 0)) return fail("Sayılan miktarı yaz.");
  const { error } = await supabase.rpc("count_ingredient", { p_ingredient: id, p_counted: counted });
  return done(error);
}

export async function countProduct(id: string, counted: number): Promise<ActionResult> {
  const { supabase } = await requireMember(["admin"]);
  if (!(counted >= 0)) return fail("Sayılan adedi yaz.");
  const { error } = await supabase.rpc("count_product", { p_product: id, p_counted: counted });
  return done(error);
}
