"use server";

// First step after sign-up: prove the e-mail, then open a business as its admin (employees are added by their admin).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage } from "@/lib/db";
import { redirectWith, text } from "@/lib/form";
import { getSession } from "@/lib/session";
import { authCallback } from "@/lib/site";
import { authMessage } from "@/lib/domain/auth";

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

/** Sends a sign-in link to the user's own address; opening it proves the e-mail is theirs. */
export async function sendEmailProof() {
  const s = await getSession();
  if (!s.userId || !s.email) redirect("/login");
  const { error } = await s.supabase.auth.signInWithOtp({
    email: s.email,
    options: { shouldCreateUser: false, emailRedirectTo: await authCallback("/setup") },
  });
  if (error) redirectWith(PAGE, "error", authMessage(error, "Doğrulama e-postası gönderilemedi. Biraz sonra tekrar dene."));
  redirect(`${PAGE}?sent=1`);
}
