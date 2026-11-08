"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage } from "@/lib/db";
import { redirectWith, text as str } from "@/lib/form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (path: string, msg: string): never => redirectWith(path, "error", msg);

async function siteOrigin() {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------- auth (e-mail magic link) ----------
export async function sendLoginLink(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  if (str(fd, "website")) redirect("/login?sent=1"); // honeypot for bots
  if (!EMAIL_RE.test(email)) fail("/login", "Geçerli bir e-posta adresi yaz.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/app` },
  });
  if (error) fail("/login", "Bağlantı gönderilemedi. Birkaç dakika sonra tekrar dene.");
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------- setup: create a business or join one ----------
export async function createBusiness(fd: FormData) {
  const name = str(fd, "name", 80);
  const owner = str(fd, "owner", 60);
  const sector = str(fd, "sector", 20) || "bakery";
  if (name.length < 2) fail("/setup", "Dükkânının adını yaz.");
  if (!owner) fail("/setup", "Adını yaz.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_business", { p_name: name, p_sector: sector, p_owner_name: owner });
  if (error) fail("/setup", dbMessage(error, "Dükkân oluşturulamadı. Tekrar dene."));
  revalidatePath("/", "layout");
  redirect("/app/catalog?welcome=1");
}

export async function joinBusiness(fd: FormData) {
  const code = str(fd, "code", 10).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const name = str(fd, "name", 60);
  if (code.length !== 6) fail("/setup", "Davet kodu 6 karakter olmalı.");
  if (!name) fail("/setup", "Adını yaz.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_code: code, p_name: name });
  if (error) fail("/setup", dbMessage(error, "Davet kodu kullanılamadı."));
  revalidatePath("/", "layout");
  redirect("/app");
}
