"use server";

// Admin-only team management: adding people, moving them between places, removing them.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { authMessage, checkEmail, checkNewPassword } from "@/lib/domain/auth";
import { authCallback } from "@/lib/site";
import { dbMessage } from "@/lib/db";
import { redirectWith, text } from "@/lib/form";

const PAGE = "/app/team";

/**
 * Admin adds an employee directly: name, e-mail, a starting password and the place they work at.
 * The account is opened with the public sign-up (the app never holds a secret key), using a separate
 * client so the admin stays signed in; the person joins the place on their first sign-in.
 */
export async function addStaff(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const name = text(fd, "name", 60);
  const place = text(fd, "place", 40);
  if (!name) redirectWith(PAGE, "error", "Çalışanın adını yaz.");
  const mail = checkEmail(fd.get("email"));
  if (!mail.ok) redirectWith(PAGE, "error", mail.error);
  const password = checkNewPassword(fd.get("password"));
  if (!password.ok) redirectWith(PAGE, "error", password.error);
  if (!place) redirectWith(PAGE, "error", "Çalışacağı yeri seç.");

  const { data: code, error } = await supabase.rpc("add_staff", { p_name: name, p_email: mail.value, p_place: place });
  if (error || typeof code !== "string") redirectWith(PAGE, "error", dbMessage(error, "Çalışan eklenemedi."));

  const signup = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error: authError } = await signup.auth.signUp({
    email: mail.value,
    password: password.value,
    options: { emailRedirectTo: await authCallback("/app"), data: { name } },
  });
  if (authError) {
    await supabase.from("invites").delete().eq("code", code);
    redirectWith(PAGE, "error", authMessage(authError, "Hesap açılamadı. Tekrar dene."));
  }
  revalidatePath(PAGE);
  // An address that already has an account comes back without identities: it joins with its own password.
  const state = data.user?.identities?.length === 0 ? "existing" : data.session ? "ready" : "confirm";
  redirect(`${PAGE}?added=${encodeURIComponent(mail.value)}&state=${state}`);
}

export async function assignMember(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const place = text(fd, "place", 40) || null;
  const { error } = await supabase.rpc("assign_member", { p_user: text(fd, "user_id", 40), p_place: place });
  if (error) redirectWith(PAGE, "error", dbMessage(error, "Çalışanın yeri değiştirilemedi."));
  revalidatePath("/app", "layout");
  redirectWith(PAGE, "ok", "Çalışanın yeri güncellendi.");
}

export async function deleteInvite(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const { error } = await supabase.from("invites").delete().eq("code", text(fd, "code", 10));
  if (error) redirectWith(PAGE, "error", "Kayıt iptal edilemedi.");
  revalidatePath(PAGE);
}

export async function removeMember(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const { error } = await supabase.from("members").delete().eq("user_id", text(fd, "user_id", 40));
  if (error) redirectWith(PAGE, "error", "Kişi çıkarılamadı.");
  revalidatePath(PAGE);
  redirectWith(PAGE, "ok", "Kişi ekipten çıkarıldı.");
}
