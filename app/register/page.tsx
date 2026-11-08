import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { AuthCard, Honeypot } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";
import { getSession } from "@/lib/session";
import { PASSWORD_MIN } from "@/lib/domain/auth";
import { signUp } from "../_actions/auth";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  if ((await getSession()).userId) redirect("/app");
  const sp = await searchParams;
  const email = param(sp.email);

  if (param(sp.sent)) {
    return (
      <AuthCard title="E-postanı doğrula" footer={<>Doğruladın mı? <Link href="/login">Giriş yap</Link></>}>
        <p>{email ? <><b style={{ color: "var(--ink)" }}>{email}</b> adresine</> : "E-postana"} bir doğrulama bağlantısı gönderdik. Bağlantıya dokununca hesabın açılır ve dükkânını kurmaya geçersin.</p>
        <p style={{ fontSize: 14 }}>Gelmediyse istenmeyen (spam) klasörüne bak.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Kayıt ol" intro="Dükkânın için ücretsiz bir hesap aç. Çalışanların, sana verilen davet koduyla aynı ekrandan kayıt olur."
      footer={<>Zaten hesabın var mı? <Link href="/login">Giriş yap</Link></>}>
      <Alert error={param(sp.error)} />
      <form action={signUp} style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="email" required
            defaultValue={email ?? ""} placeholder="ornek@gmail.com" />
        </div>
        <PasswordInput id="password" name="password" label="Şifre" autoComplete="new-password" hint={`en az ${PASSWORD_MIN} karakter, harf ve rakam`} />
        <PasswordInput id="password_repeat" name="password_repeat" label="Şifre tekrar" autoComplete="new-password" />
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "4px 0 18px", fontSize: 14, color: "var(--muted)" }}>
          <input type="checkbox" name="terms" required style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
          <span>Kullanım koşullarını ve kişisel verilerin işlenmesine dair aydınlatma metnini okudum, kabul ediyorum.</span>
        </label>
        <Honeypot />
        <button className="btn block" type="submit">Kayıt ol</button>
      </form>
    </AuthCard>
  );
}
