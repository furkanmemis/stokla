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
  const sent = param(sp.sent);
  const email = param(sp.email);

  return (
    <main className="wrap">
      <p style={{ margin: "18px 0 26px" }}><Link href="/" style={{ color: "inherit", textDecoration: "none" }}><Wordmark size={26} /></Link></p>
      {sent ? (
        <div className="card">
          <h1>E-postana bak</h1>
          <p>{email ? <><b>{email}</b> adresine</> : "E-postana"} bir giriş bağlantısı gönderdik. Bağlantıya bu telefondan dokun, şifre gerekmez.</p>
          <p className="hint">Gelmediyse istenmeyen (spam) klasörüne bak ya da birkaç dakika sonra <Link href="/login">tekrar dene</Link>.</p>
        </div>
      ) : (
        <div className="card">
          <h1>Giriş yap</h1>
          <p className="hint" style={{ marginTop: 0 }}>E-posta adresini yaz, sana şifresiz bir giriş bağlantısı gönderelim. İlk kez geliyorsan hesabın kendiliğinden açılır.</p>
          <Alert error={param(sp.error)} />
          <form action={sendLoginLink}>
            <div className="field">
              <label htmlFor="email">E-posta</label>
              <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="ornek@gmail.com" />
            </div>
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label htmlFor="website">Web sitesi</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <button className="btn block" type="submit">Giriş bağlantısı gönder</button>
          </form>
        </div>
      )}
    </main>
  );
}
