import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { Wordmark } from "@/components/Logo";
import { getSession } from "@/lib/session";
import { SECTOR_LABEL } from "@/lib/types";
import { signOut } from "../_actions/auth";
import { createBusiness, joinBusiness } from "../_actions/onboarding";

export const metadata: Metadata = { title: "Başlangıç" };

export default async function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await getSession();
  if (!s.userId) redirect("/register");
  if (s.member) redirect("/app");
  const sp = await searchParams;

  return (
    <main className="auth" style={{ alignItems: "start" }}>
      <div style={{ width: "100%", maxWidth: 880, display: "flex", flexDirection: "column", gap: 18 }}>
        <Wordmark size={24} />
        <div className="page-head"><h1>Hoş geldin</h1></div>
        <p className="lead">Dükkânın sahibi misin, yoksa bir dükkânda mı çalışıyorsun?</p>
        <Alert error={param(sp.error)} />
        <div className="row">
          <form className="panel" action={createBusiness}>
            <h2>Dükkânımı oluştur</h2>
            <p className="lead" style={{ marginBottom: 14 }}>Admin olarak girersin; ürünleri ve ekibi sen eklersin.</p>
            <div className="field">
              <label htmlFor="name">Dükkânın adı</label>
              <input className="input" id="name" name="name" required maxLength={80} placeholder="Örn. Gül Pastanesi" />
            </div>
            <div className="field">
              <label htmlFor="sector">Ne iş yapıyorsun?</label>
              <select className="input" id="sector" name="sector" defaultValue="bakery">
                {Object.entries(SECTOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="owner">Senin adın</label>
              <input className="input" id="owner" name="owner" required maxLength={60} autoComplete="given-name" placeholder="Ekipte görünecek ad" />
            </div>
            <button className="btn block" type="submit">Dükkânı oluştur</button>
          </form>

          <form className="panel" action={joinBusiness}>
            <h2>Davet koduyla katıl</h2>
            <p className="lead" style={{ marginBottom: 14 }}>Dükkânın admininden aldığın 6 haneli kodu yaz.</p>
            <div className="field">
              <label htmlFor="code">Davet kodu</label>
              <input className="input" id="code" name="code" required maxLength={8} autoCapitalize="characters" autoComplete="off"
                placeholder="K7M2QX" style={{ textTransform: "uppercase", letterSpacing: ".18em", fontWeight: 800 }} />
            </div>
            <div className="field">
              <label htmlFor="jname">Senin adın</label>
              <input className="input" id="jname" name="name" required maxLength={60} autoComplete="given-name" />
            </div>
            <button className="btn dark block" type="submit">Katıl</button>
          </form>
        </div>
        <form action={signOut}>
          <button className="btn small secondary" type="submit">{s.email ?? "Hesap"} hesabından çık</button>
        </form>
      </div>
    </main>
  );
}
