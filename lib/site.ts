import { headers } from "next/headers";

/** The site's own address, for links in e-mails: a fixed one if configured, else the request's host. */
export async function siteOrigin() {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Where e-mail links land: the auth callback, then `next`. */
export const authCallback = async (next: string) => `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
