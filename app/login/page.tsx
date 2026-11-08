import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { AuthCard } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";
import { getSession } from "@/lib/session";
import { signIn } from "../_actions/auth";

export const metadata: Metadata = { title: "Giriş yap" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  if ((await getSession()).userId) redirect("/app");
  const sp = await searchParams;

  return (
    <AuthCard title="Giriş yap" intro="Dükkânının paneline e-posta ve şifrenle gir."
      footer={<>Hesabın yok mu? <Link href="/register">Kayıt ol</Link></>}>
      <Alert error={param(sp.error)} info={param(sp.ok)} />
      <form action={signIn} style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="email" required
            defaultValue={param(sp.email) ?? ""} placeholder="ornek@gmail.com" />
        </div>
        <PasswordInput id="password" name="password" label="Şifre" autoComplete="current-password" />
        <p style={{ margin: "-4px 0 16px", textAlign: "right", fontSize: 14 }}><Link href="/forgot-password">Şifremi unuttum</Link></p>
        <button className="btn block" type="submit">Giriş yap</button>
      </form>
    </AuthCard>
  );
}
