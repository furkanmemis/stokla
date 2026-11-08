// Pure validation for the sign-in, sign-up and password screens. Messages are shown to users as-is.

export const PASSWORD_MIN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

export function checkEmail(raw: unknown): Check<string> {
  const email = String(raw ?? "").trim().toLowerCase().slice(0, 200);
  return EMAIL_RE.test(email) ? { ok: true, value: email } : { ok: false, error: "Geçerli bir e-posta adresi yaz." };
}

/** At least 8 characters with a letter and a digit; the repeat must match when given. */
export function checkNewPassword(raw: unknown, repeat?: unknown): Check<string> {
  const password = String(raw ?? "");
  if (password.length < PASSWORD_MIN) return { ok: false, error: `Şifre en az ${PASSWORD_MIN} karakter olmalı.` };
  if (password.length > 72) return { ok: false, error: "Şifre en fazla 72 karakter olabilir." };
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return { ok: false, error: "Şifrede en az bir harf ve bir rakam olmalı." };
  if (repeat !== undefined && String(repeat ?? "") !== password) return { ok: false, error: "Şifreler aynı değil." };
  return { ok: true, value: password };
}

/**
 * Sign-in methods that prove the person controls their e-mail (a link or code sent there).
 * Supabase lists how the current session was obtained in the token's "amr" claim.
 */
export const EMAIL_PROOF_METHODS = ["otp", "magiclink", "email/signup", "recovery", "email_change", "invite"] as const;

/** Whether this session came from a link or code sent to the person's e-mail. */
export function emailProven(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((a) => (EMAIL_PROOF_METHODS as readonly string[]).includes(String((a as { method?: unknown })?.method)));
}

/** Turns Supabase Auth errors into plain Turkish; unknown ones get the fallback. */
export function authMessage(error: { message?: string; code?: string } | null | undefined, fallback: string): string {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("invalid_credentials") || text.includes("invalid login credentials")) return "E-posta ya da şifre hatalı.";
  if (text.includes("email_not_confirmed") || text.includes("email not confirmed")) return "E-postanı henüz doğrulamadın. Gelen kutundaki doğrulama bağlantısına dokun.";
  if (text.includes("user_already_exists") || text.includes("already registered")) return "Bu e-postayla zaten bir hesap var. Giriş yap ya da şifreni sıfırla.";
  if (text.includes("weak_password")) return "Bu şifre çok zayıf. Daha uzun ve tahmin edilmesi zor bir şifre seç.";
  if (text.includes("same_password")) return "Yeni şifre eskisiyle aynı olamaz.";
  if (text.includes("rate") || text.includes("too many")) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
  return fallback;
}
