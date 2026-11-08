import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { WAITING_PATH, homeFor, resolvePlace, type Need } from "./domain/places";
import { emailProven } from "./domain/auth";
import type { Business, Member, Place, Role } from "./types";

/** Cookie holding the place an admin last worked at (employees always work at their own). */
export const PLACE_COOKIE = "stokla_place";

/**
 * The signed-in user, their membership and business (nulls when missing).
 * A user without a business is joined first if an admin added their e-mail.
 * Cached per request so the layout and the page share one lookup.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    return { supabase, userId: null, email: null, emailProven: false, member: null as Member | null, business: null as Business | null };
  }
  const loadMember = () => supabase.from("members").select("*").eq("user_id", claims.sub).maybeSingle();
  let { data: member } = await loadMember();
  if (!member) {
    const { data: joined } = await supabase.rpc("claim_staff_invite");
    if (joined) ({ data: member } = await loadMember());
  }
  const { data: business } = member
    ? await supabase.from("businesses").select("*").eq("id", member.business_id).maybeSingle()
    : { data: null };
  return {
    supabase,
    userId: claims.sub as string,
    email: typeof claims.email === "string" ? claims.email : null,
    /** This session came from a link or code sent to the user's e-mail (needed to open a business). */
    emailProven: emailProven((claims as { amr?: unknown }).amr),
    member: (member as Member | null) ?? null,
    business: (business as Business | null) ?? null,
  };
});

/** Every place of the business, open ones first (employees can read the list too). */
export const getPlaces = cache(async () => {
  const { supabase } = await getSession();
  const { data } = await supabase.from("locations").select("*").order("active", { ascending: false }).order("created_at");
  return (data ?? []) as Place[];
});

/** The place an employee is assigned to (null for admins and unassigned employees). */
export async function memberPlace(member: Member): Promise<Place | null> {
  if (!member.location_id) return null;
  return (await getPlaces()).find((p) => p.id === member.location_id) ?? null;
}

/** Guards a page inside the app: signed out → /login, no business yet → /setup, role not allowed → its home. */
export async function requireMember(allowed?: Role[]) {
  const s = await getSession();
  if (!s.userId) redirect("/login");
  if (!s.member || !s.business) redirect("/setup");
  if (allowed && !allowed.includes(s.member.role)) redirect(homeFor(s.member.role, await memberPlace(s.member)));
  return { supabase: s.supabase, userId: s.userId, member: s.member, business: s.business };
}

const NO_PLACE_FOR: Record<Exclude<Need, null> | "any", string> = {
  produce: "Bu ekran için üretim yapan bir yer gerekiyor. Yerler bölümünden ekle.",
  sell: "Bu ekran için satış yapan bir yer gerekiyor. Yerler bölümünden ekle.",
  any: "Önce dükkânının yerlerini ekle: üretim yeri, satış yeri ya da ikisi birden.",
};

/**
 * Guards a screen that works at one place and returns that place.
 * Employees get their own place; admins the one they picked (or the first that fits).
 */
export async function requirePlace(need: Need = null) {
  const session = await requireMember();
  const places = await getPlaces();
  const chosenId = session.member.role === "admin" ? (await cookies()).get(PLACE_COOKIE)?.value ?? null : null;
  const r = resolvePlace({ role: session.member.role, assignedId: session.member.location_id, chosenId, places, need });
  if (!r.ok) {
    if (session.member.role === "employee") {
      redirect(r.reason === "unassigned" ? WAITING_PATH : homeFor("employee", await memberPlace(session.member)));
    }
    redirect(`/app/places?error=${encodeURIComponent(NO_PLACE_FOR[need ?? "any"])}`);
  }
  return { ...session, place: r.place, places };
}
