import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Landing point for the login link in the e-mail ("?code=" PKCE flow or "?token_hash=&type=").
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  const supabase = await createClient();
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  if (ok) return NextResponse.redirect(new URL(next, url.origin));
  const msg = "Bağlantı geçersiz ya da süresi dolmuş. E-postayı istediğin telefonda açtığından emin ol ya da yeni bağlantı iste.";
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));
}
