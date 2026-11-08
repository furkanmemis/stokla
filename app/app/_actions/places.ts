"use server";

// Places (branches): admins add and change them; anyone may switch which place a screen shows if allowed.
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPlaces, PLACE_COOKIE, requireMember } from "@/lib/session";
import { checkPlace } from "@/lib/domain/places";
import { dbMessage } from "@/lib/db";
import { redirectWith, text } from "@/lib/form";

const PAGE = "/app/places";

export async function savePlace(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const id = text(fd, "id", 40) || null;
  const checked = checkPlace({
    name: text(fd, "name", 80),
    address: text(fd, "address", 200),
    canProduce: fd.get("can_produce") === "on",
    canSell: fd.get("can_sell") === "on",
  }, await getPlaces(), id);
  const back = id ? `${PAGE}?edit=${id}` : `${PAGE}?new=1`;
  if (!checked.ok) redirectWith(back, "error", checked.error);
  const v = checked.value;
  const { error } = await supabase.rpc("save_place", {
    p_id: id, p_name: v.name, p_can_produce: v.canProduce, p_can_sell: v.canSell, p_address: v.address,
  });
  if (error) redirectWith(back, "error", dbMessage(error, "Yer kaydedilemedi."));
  revalidatePath("/app", "layout");
  redirectWith(PAGE, "ok", id ? `${v.name} güncellendi.` : `${v.name} eklendi.`);
}

export async function setPlaceActive(fd: FormData) {
  const { supabase } = await requireMember(["admin"]);
  const active = fd.get("active") === "true";
  const { error } = await supabase.rpc("set_place_active", { p_id: text(fd, "id", 40), p_active: active });
  if (error) redirectWith(PAGE, "error", dbMessage(error, "Yer güncellenemedi."));
  revalidatePath("/app", "layout");
  redirectWith(PAGE, "ok", active ? "Yer yeniden açıldı." : "Yer kapatıldı. Geçmişi duruyor.");
}

/** Remembers which place an admin is working at; the screens read it on the next render. */
export async function choosePlace(id: string) {
  const { member } = await requireMember(["admin"]);
  if (member.role !== "admin" || !(await getPlaces()).some((p) => p.id === id && p.active)) return;
  (await cookies()).set(PLACE_COOKIE, id, { path: "/app", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/app", "layout");
}
