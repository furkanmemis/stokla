"use server";

// Account actions: sign in, sign up, sign out and password reset (e-mail + password).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirectWith, text } from "@/lib/form";
import { authMessage, checkEmail, checkNewPassword } from "@/lib/domain/auth";
import { authCallback } from "@/lib/site";

const isBot = (fd: FormData) => text(fd, "website") !== ""; // hidden honeypot field

const callback = authCallback;

export async function signIn(fd: FormData) {
  const email = checkEmail(fd.get("email"));
  const password = String(fd.get("password") ?? "");
  if (!email.ok) redirectWith("/login", "error", email.error);
  if (!password) redirectWith(`/login?email=${encodeURIComponent(email.value)}`, "error", "Şifreni yaz.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.value, password });
  if (error) redirectWith(`/login?email=${encodeURIComponent(email.value)}`, "error", authMessage(error, "Giriş yapılamadı. Tekrar dene."));
  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signUp(fd: FormData) {
  if (isBot(fd)) redirect("/register?sent=1");
  const email = checkEmail(fd.get("email"));
  if (!email.ok) redirectWith("/register", "error", email.error);
  const password = checkNewPassword(fd.get("password"), fd.get("password_repeat"));
  if (!password.ok) redirectWith(`/register?email=${encodeURIComponent(email.value)}`, "error", password.error);
  if (fd.get("terms") !== "on") redirectWith(`/register?email=${encodeURIComponent(email.value)}`, "error", "Devam etmek için kullanım koşullarını onayla.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: { emailRedirectTo: await callback("/setup") },
  });
  if (error) redirectWith(`/register?email=${encodeURIComponent(email.value)}`, "error", authMessage(error, "Kayıt olunamadı. Tekrar dene."));
  // With e-mail confirmation on, an existing address comes back without identities instead of an error.
  if (data.user && data.user.identities?.length === 0) {
    redirectWith(`/login?email=${encodeURIComponent(email.value)}`, "error", "Bu e-postayla zaten bir hesap var. Giriş yap ya da şifreni sıfırla.");
  }
  if (data.session) { revalidatePath("/", "layout"); redirect("/setup"); } // confirmation turned off
  redirect(`/register?sent=1&email=${encodeURIComponent(email.value)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(fd: FormData) {
  if (isBot(fd)) redirect("/forgot-password?sent=1");
  const email = checkEmail(fd.get("email"));
  if (!email.ok) redirectWith("/forgot-password", "error", email.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.value, { redirectTo: await callback("/reset-password") });
  if (error) redirectWith("/forgot-password", "error", authMessage(error, "Bağlantı gönderilemedi. Birkaç dakika sonra tekrar dene."));
  // Same answer whether or not the address has an account, so the form cannot be used to probe e-mails.
  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email.value)}`);
}

export async function updatePassword(fd: FormData) {
  const password = checkNewPassword(fd.get("password"), fd.get("password_repeat"));
  if (!password.ok) redirectWith("/reset-password", "error", password.error);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirectWith("/forgot-password", "error", "Bağlantının süresi dolmuş. Yeni bir sıfırlama bağlantısı iste.");
  const { error } = await supabase.auth.updateUser({ password: password.value });
  if (error) redirectWith("/reset-password", "error", authMessage(error, "Şifre değiştirilemedi. Tekrar dene."));
  revalidatePath("/", "layout");
  redirect("/app");
}
