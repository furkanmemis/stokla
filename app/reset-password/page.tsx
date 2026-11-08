import type { Metadata } from "next";
import Link from "next/link";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { AuthCard } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";
import { getSession } from "@/lib/session";
import { PASSWORD_MIN } from "@/lib/domain/auth";
import { updatePassword } from "../_actions/auth";

export const metadata: Metadata = { title: "Yeni şifre" };

/** Reached from the reset e-mail (the callback signs the user in first). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  if (!(await getSession()).userId) {
    return (
      <AuthCard title="Bağlantının süresi dolmuş" footer={<Link href="/login">Girişe dön</Link>}>
        <p>Şifre sıfırlama bağlantısı geçersiz ya da kullanılmış. <Link href="/forgot-password">Yeni bir bağlantı iste</Link>.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Yeni şifreni belirle">
      <Alert error={param(sp.error)} />
      <form action={updatePassword} style={{ marginTop: 14 }}>
        <PasswordInput id="password" name="password" label="Yeni şifre" autoComplete="new-password" hint={`en az ${PASSWORD_MIN} karakter, harf ve rakam`} />
        <PasswordInput id="password_repeat" name="password_repeat" label="Yeni şifre tekrar" autoComplete="new-password" />
        <button className="btn block" type="submit">Şifreyi kaydet</button>
      </form>
    </AuthCard>
  );
}
