import type { Metadata } from "next";
import Link from "next/link";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { AuthCard, Honeypot } from "@/components/AuthCard";
import { requestPasswordReset } from "../_actions/auth";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const email = param(sp.email);

  if (param(sp.sent)) {
    return (
      <AuthCard title="E-postana bak" footer={<Link href="/login">Girişe dön</Link>}>
        <p>{email ? <><b style={{ color: "var(--ink)" }}>{email}</b> ile</> : "Bu e-postayla"} kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderdik. Bağlantıya dokunup yeni şifreni belirle.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Şifremi unuttum" intro="Hesabının e-postasını yaz; yeni şifre belirlemen için bir bağlantı gönderelim."
      footer={<Link href="/login">Girişe dön</Link>}>
      <Alert error={param(sp.error)} />
      <form action={requestPasswordReset} style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="ornek@gmail.com" />
        </div>
        <Honeypot />
        <button className="btn block" type="submit">Sıfırlama bağlantısı gönder</button>
      </form>
    </AuthCard>
  );
}
