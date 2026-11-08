import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { Wordmark } from "@/components/Logo";
import { getSession } from "@/lib/session";
import { sendLoginLink } from "../_actions/auth";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await getSession();
  if (s.userId) redirect("/app");
  const sp = await searchParams;
  const email = param(sp.email);

  return (
    <main className="auth">
      <div className="auth-card">
        <Link href="/" style={{ textDecoration: "none" }}><Wordmark size={24} /></Link>
        {param(sp.sent) ? (
          <>
            <h1>E-postana bak</h1>
            <p>{email ? <><b style={{ color: "var(--ink)" }}>{email}</b> adresine</> : "E-postana"} bir giriş bağlantısı gönderdik. Bağlantıya bu cihazdan dokun; şifre gerekmez.</p>
            <p style={{ fontSize: 14 }}>Gelmediyse istenmeyen (spam) klasörüne bak ya da birkaç dakika sonra <Link href="/login">tekrar dene</Link>.</p>
          </>
        ) : (
          <>
            <h1>Giriş yap</h1>
            <p>E-posta adresini yaz, sana şifresiz bir giriş bağlantısı gönderelim. İlk kez geliyorsan hesabın kendiliğinden açılır.</p>
            <Alert error={param(sp.error)} />
            <form action={sendLoginLink} style={{ marginTop: 14 }}>
              <div className="field">
                <label htmlFor="email">E-posta</label>
                <input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="ornek@gmail.com" />
              </div>
              <div aria-hidden="true" className="sr-only">
                <label htmlFor="website">Web sitesi</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <button className="btn block" type="submit">Giriş bağlantısı gönder</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
