import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { Wordmark } from "@/components/Logo";
import { getSession } from "@/lib/session";
import { SECTOR_LABEL } from "@/lib/types";
import { createBusiness, joinBusiness, signOut } from "../_actions/auth";

export const metadata: Metadata = { title: "Başlangıç" };

export default async function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await getSession();
  if (!s.userId) redirect("/login");
  if (s.member) redirect("/app");
  const sp = await searchParams;

  return (
    <main className="wrap">
      <p style={{ margin: "18px 0 22px" }}><Wordmark size={24} /></p>
      <h1>Hoş geldin!</h1>
      <p className="sub" style={{ marginLeft: 0 }}>Dükkânın sahibi misin, yoksa bir dükkânda mı çalışıyorsun?</p>
      <Alert error={param(sp.error)} />

      <form className="card" action={createBusiness}>
        <h3>Dükkânımı oluştur</h3>
        <p className="hint" style={{ marginTop: 0 }}>Patron olarak girersin; ürünleri ve ekibi sen eklersin.</p>
        <div className="field">
          <label htmlFor="name">Dükkânın adı</label>
          <input id="name" name="name" type="text" required maxLength={80} placeholder="Örn. Gül Pastanesi" />
        </div>
        <div className="field">
          <label htmlFor="sector">Ne iş yapıyorsun?</label>
          <select id="sector" name="sector" defaultValue="bakery">
            {Object.entries(SECTOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="owner">Senin adın</label>
          <input id="owner" name="owner" type="text" required maxLength={60} autoComplete="given-name" placeholder="Ekipte görünecek ad" />
        </div>
        <button className="btn block" type="submit">Dükkânı oluştur</button>
      </form>

      <form className="card" action={joinBusiness}>
        <h3>Davet koduyla katıl</h3>
        <p className="hint" style={{ marginTop: 0 }}>Patronun sana verdiği 6 haneli kodu yaz.</p>
        <div className="field">
          <label htmlFor="code">Davet kodu</label>
          <input id="code" name="code" type="text" required maxLength={8} autoCapitalize="characters" autoComplete="off"
            placeholder="ÖRN. K7M2QX" style={{ textTransform: "uppercase", letterSpacing: ".15em", fontWeight: 700 }} />
        </div>
        <div className="field">
          <label htmlFor="jname">Senin adın</label>
          <input id="jname" name="name" type="text" required maxLength={60} autoComplete="given-name" />
        </div>
        <button className="btn dark block" type="submit">Katıl</button>
      </form>

      <form action={signOut} style={{ textAlign: "center" }}>
        <button className="hint" type="submit" style={{ textDecoration: "underline" }}>{s.email ?? "Hesap"} · çıkış yap</button>
      </form>
    </main>
  );
}
