import type { Metadata } from "next";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { requireMember } from "@/lib/session";
import { ROLE_LABEL, type Invite, type Member } from "@/lib/types";
import { createInvite, deleteInvite, removeMember } from "../_actions/team";

export const metadata: Metadata = { title: "Ekip" };

const date = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" });

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, userId } = await requireMember(["admin"]);
  const sp = await searchParams;
  const [{ data: m }, { data: i }] = await Promise.all([
    supabase.from("members").select("*").order("created_at"),
    supabase.from("invites").select("*").is("used_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  const members = (m ?? []) as Member[];
  const invites = (i ?? []) as Invite[];
  const fresh = param(sp.code);

  return (
    <>
      <div className="page-head">
        <h1>Ekip</h1>
        <form action={createInvite}><button className="btn" type="submit">Çalışan davet et</button></form>
      </div>
      <p className="lead">Çalışanlar satış, üretim ve mal girişi yapar. Fiyatları, tarifleri, sayımı ve ekibi sadece admin yönetir.</p>
      <Alert error={param(sp.error)} info={param(sp.ok)} />

      {fresh && (
        <section className="panel" style={{ textAlign: "center", borderColor: "var(--brand)" }} aria-live="polite">
          <p className="lead" style={{ margin: 0 }}>Davet kodu</p>
          <p className="code">{fresh}</p>
          <p className="lead" style={{ margin: "0 auto", maxWidth: "48ch" }}>Bu kodu çalışanına gönder. Stokla&apos;ya e-postasıyla girip &quot;Davet koduyla katıl&quot; demeli. Kod 7 gün geçerli ve tek kullanımlık.</p>
        </section>
      )}

      <div className="row">
        <section className="panel wide" aria-labelledby="h-team">
          <h2 id="h-team">Ekip üyeleri</h2>
          <ul className="list">
            {members.map((x) => (
              <li key={x.user_id}>
                <span className={`avatar ${x.role}`} aria-hidden="true">{x.name.charAt(0).toLocaleUpperCase("tr-TR")}</span>
                <span className="grow"><b>{x.name}{x.user_id === userId ? " (sen)" : ""}</b><small>{ROLE_LABEL[x.role]}</small></span>
                {x.user_id !== userId && (
                  <form action={removeMember}>
                    <input type="hidden" name="user_id" value={x.user_id} />
                    <button className="btn small secondary" type="submit">Ekipten çıkar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel" aria-labelledby="h-invites">
          <h2 id="h-invites">Bekleyen davetler</h2>
          {invites.length ? (
            <ul className="list">
              {invites.map((x) => (
                <li key={x.code}>
                  <span className="grow"><b style={{ letterSpacing: ".14em" }}>{x.code}</b><small>{date(x.expires_at)} tarihine kadar geçerli</small></span>
                  <form action={deleteInvite}>
                    <input type="hidden" name="code" value={x.code} />
                    <button className="btn small secondary" type="submit">İptal et</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className="empty">Bekleyen davet yok.</p>}
        </section>
      </div>
    </>
  );
}
