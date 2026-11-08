"use server";

// Stock movements. Each one is a single database function call, so stock and history change together.
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { dbMessage } from "@/lib/db";
import { sanitizeLines, type StockLine } from "@/lib/domain/stock";

export type ActionResult = { ok: true } | { ok: false; error: string };

const NETWORK_HINT = "Kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.";

async function done(error: { code?: string; message?: string } | null, fallback = NETWORK_HINT): Promise<ActionResult> {
  if (error) return { ok: false, error: dbMessage(error, fallback) };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function recordSale(items: StockLine[], waste: boolean): Promise<ActionResult> {
  const { supabase } = await requireMember(["owner", "counter"]);
  const lines = sanitizeLines(items);
  if (!lines.length) return { ok: false, error: "Ürün seçilmedi." };
  const { error } = await supabase.rpc("record_sale", { p_items: lines, p_waste: waste === true });
  return done(error);
}

export async function recordProduction(items: StockLine[]): Promise<ActionResult> {
  const { supabase } = await requireMember(["owner", "kitchen"]);
  const lines = sanitizeLines(items);
  if (!lines.length) return { ok: false, error: "Adet girmedin." };
  const { error } = await supabase.rpc("record_production", { p_items: lines });
  return done(error);
}

export async function receiveIngredient(id: string, qty: number, note?: string): Promise<ActionResult> {
  const { supabase } = await requireMember(["owner", "kitchen", "depot"]);
  if (!(qty > 0)) return { ok: false, error: "Gelen miktarı yaz." };
  const { error } = await supabase.rpc("receive_ingredient", { p_ingredient: id, p_qty: qty, p_note: note ?? null });
  return done(error);
}

export async function countIngredient(id: string, counted: number): Promise<ActionResult> {
  const { supabase } = await requireMember(["owner", "depot"]);
  if (!(counted >= 0)) return { ok: false, error: "Sayılan miktarı yaz." };
  const { error } = await supabase.rpc("count_ingredient", { p_ingredient: id, p_counted: counted });
  return done(error);
}
