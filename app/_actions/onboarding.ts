"use server";

// First steps after sign-up: open a business (as its admin) or join one with an invite code.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage } from "@/lib/db";
import { redirectWith, text } from "@/lib/form";

const PAGE = "/setup";

export async function createBusiness(fd: FormData) {
  const name = text(fd, "name", 80);
  const owner = text(fd, "owner", 60);
  const sector = text(fd, "sector", 20) || "bakery";
  if (name.length < 2) redirectWith(PAGE, "error", "Dükkânının adını yaz.");
  if (!owner) redirectWith(PAGE, "error", "Adını yaz.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_business", { p_name: name, p_sector: sector, p_owner_name: owner });
  if (error) redirectWith(PAGE, "error", dbMessage(error, "Dükkân oluşturulamadı. Tekrar dene."));
  revalidatePath("/", "layout");
  redirect("/app/catalog?welcome=1");
}

export async function joinBusiness(fd: FormData) {
  const code = text(fd, "code", 10).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const name = text(fd, "name", 60);
  if (code.length !== 6) redirectWith(PAGE, "error", "Davet kodu 6 karakter olmalı.");
  if (!name) redirectWith(PAGE, "error", "Adını yaz.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_code: code, p_name: name });
  if (error) redirectWith(PAGE, "error", dbMessage(error, "Davet kodu kullanılamadı."));
  revalidatePath("/", "layout");
  redirect("/app");
}
