"use server";

// First step after sign-up: open a business as its admin (employees are added by their admin).
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
