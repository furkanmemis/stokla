import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { Wordmark } from "@/components/Logo";
import { getSession } from "@/lib/session";
import { SECTOR_LABEL } from "@/lib/types";
import { signOut } from "../_actions/auth";
import { createBusiness } from "../_actions/onboarding";

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
        <p className="lead">Dükkânını oluştur. Bir dükkânda çalışıyorsan hesabını adminin açar.</p>
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

          <section className="panel">
            <h2>Bir dükkânda mı çalışıyorsun?</h2>
            <p className="lead">Çalışanların hesabını dükkânın admini açar. Adminin sana verdiği e-posta ve şifreyle giriş yaptığında doğrudan çalıştığın yere bağlanırsın.</p>
            <p className="lead" style={{ marginBottom: 0 }}>Bu ekranı görüyorsan ve bir dükkânda çalışıyorsan, admininden seni bu e-postayla ({s.email ?? "giriş yaptığın adres"}) eklemesini iste.</p>
          </section>
        </div>
        <form action={signOut}>
          <button className="btn small secondary" type="submit">{s.email ?? "Hesap"} hesabından çık</button>
        </form>
      </div>
    </main>
  );
}
