"use server";

// Owner-only team management: invite codes and removing staff.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { dbMessage } from "@/lib/db";
import { redirectWith, text } from "@/lib/form";

const PAGE = "/app/team";

export async function createInvite() {
  const { supabase } = await requireMember(["admin"]);
  const { data, error } = await supabase.rpc("create_invite");
  if (error || typeof data !== "string") redirectWith(PAGE, "error", dbMessage(error, "Davet kodu oluşturulamadı."));
  revalidatePath(PAGE);
  redirect(`${PAGE}?code=${encodeURIComponent(data)}`);
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
