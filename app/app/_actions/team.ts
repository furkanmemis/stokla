"use server";

// Admin-only team management: adding people (by e-mail or invite code), moving them between places,
// removing them.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { checkEmail } from "@/lib/domain/auth";
import { dbMessage } from "@/lib/db";
import { redirectWith, text } from "@/lib/form";

const PAGE = "/app/team";

/** Adds an employee by name and e-mail; they join the chosen place when they sign up with that address. */
export async function addStaff(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const name = text(fd, "name", 60);
  const email = text(fd, "email", 200).toLowerCase();
  const place = text(fd, "place", 40);
  if (!name) redirectWith(PAGE, "error", "Çalışanın adını yaz.");
  const mail = checkEmail(email);
  if (!mail.ok) redirectWith(PAGE, "error", mail.error);
  if (!place) redirectWith(PAGE, "error", "Çalışacağı yeri seç.");
  const { error } = await supabase.rpc("add_staff", { p_name: name, p_email: email, p_place: place });
  if (error) redirectWith(PAGE, "error", dbMessage(error, "Çalışan eklenemedi."));
  revalidatePath(PAGE);
  redirect(`${PAGE}?added=${encodeURIComponent(email)}`);
}

export async function createInvite(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const place = text(fd, "place", 40);
  if (!place) redirectWith(PAGE, "error", "Çalışacağı yeri seç.");
  const { data, error } = await supabase.rpc("create_invite", { p_place: place });
  if (error || typeof data !== "string") redirectWith(PAGE, "error", dbMessage(error, "Davet kodu oluşturulamadı."));
  revalidatePath(PAGE);
  redirect(`${PAGE}?code=${encodeURIComponent(data)}`);
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
  if (error) redirectWith(PAGE, "error", "Davet iptal edilemedi.");
  revalidatePath(PAGE);
}

export async function removeMember(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const { error } = await supabase.from("members").delete().eq("user_id", text(fd, "user_id", 40));
  if (error) redirectWith(PAGE, "error", "Kişi çıkarılamadı.");
  revalidatePath(PAGE);
  redirectWith(PAGE, "ok", "Kişi ekipten çıkarıldı.");
}
