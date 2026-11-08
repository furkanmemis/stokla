import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { ROLE_NAV, type Business, type Member, type Role } from "./types";

/**
 * The signed-in user, their membership and business (nulls when missing).
 * Cached per request so the layout and the page share one lookup.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, userId: null, email: null, member: null as Member | null, business: null as Business | null };
  const { data: member } = await supabase.from("members").select("*").eq("user_id", claims.sub).maybeSingle();
  const { data: business } = member
    ? await supabase.from("businesses").select("*").eq("id", member.business_id).maybeSingle()
    : { data: null };
  return {
    supabase,
    userId: claims.sub as string,
    email: typeof claims.email === "string" ? claims.email : null,
    member: (member as Member | null) ?? null,
    business: (business as Business | null) ?? null,
  };
});

/** Guards a page inside the app: signed out → /login, no business yet → /setup, role not allowed → its home. */
export async function requireMember(allowed?: Role[]) {
  const s = await getSession();
  if (!s.userId) redirect("/login");
  if (!s.member || !s.business) redirect("/setup");
  if (allowed && !allowed.includes(s.member.role)) redirect(ROLE_NAV[s.member.role][0].href);
  return { supabase: s.supabase, userId: s.userId, member: s.member, business: s.business };
}
