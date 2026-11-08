import type { Metadata } from "next";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { requireMember } from "@/lib/session";
import { ROLE_HINT, ROLE_LABEL, type Invite, type Member, type Role } from "@/lib/types";
import { createInvite, deleteInvite, removeMember } from "../_actions/team";

export const metadata: Metadata = { title: "Ekip" };

const STAFF_ROLES: Role[] = ["counter", "kitchen", "depot"];

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, userId } = await requireMember(["owner"]);
  const sp = await searchParams;
  const [{ data: m }, { data: i }] = await Promise.all([
    supabase.from("members").select("*").order("created_at"),
    supabase.from("invites").select("*").is("used_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  const members = (m ?? []) as Member[];
  const invites = (i ?? []) as Invite[];
  const fresh = param(sp.code);

  return (
    <main className="wrap">
      <Alert error={param(sp.error)} info={param(sp.ok)} />
      {fresh && (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="hint" style={{ margin: 0 }}>Davet kodu</p>
          <p className="code" style={{ margin: "8px 0" }}>{fresh}</p>
          <p className="hint" style={{ margin: 0 }}>Bu kodu çalışanına gönder. O, stokla uygulamasına e-postasıyla girip &quot;Davet koduyla katıl&quot; demeli. Kod 7 gün geçerli ve tek kullanımlık.</p>
        </div>
      )}

      <h2>Ekip</h2>
      <div className="card">
        {members.map((x) => (
          <div className="row" key={x.user_id}>
            <span className="mid"><b>{x.name}{x.user_id === userId ? " (sen)" : ""}</b><small>{ROLE_LABEL[x.role]}</small></span>
            {x.user_id !== userId && (
              <form action={removeMember}>
                <input type="hidden" name="user_id" value={x.user_id} />
                <button className="btn small ghost" type="submit">Çıkar</button>
              </form>
            )}
          </div>
        ))}
      </div>

      <h2>Çalışan davet et</h2>
      <p className="sub">Rolü seç, kod oluştur. Her rol sadece kendi ekranlarını görür.</p>
      <div className="card">
        {STAFF_ROLES.map((r) => (
          <form action={createInvite} className="row" key={r}>
            <input type="hidden" name="role" value={r} />
            <span className="mid"><b>{ROLE_LABEL[r]}</b><small>{ROLE_HINT[r]}</small></span>
            <button className="btn small" type="submit">Kod oluştur</button>
          </form>
        ))}
      </div>

      {invites.length > 0 && (
        <>
          <h2>Bekleyen davetler</h2>
          <div className="card">
            {invites.map((x) => (
              <div className="row" key={x.code}>
                <span className="mid"><b style={{ letterSpacing: ".12em" }}>{x.code}</b><small>{ROLE_LABEL[x.role]} · {new Date(x.expires_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihine kadar</small></span>
                <form action={deleteInvite}>
                  <input type="hidden" name="code" value={x.code} />
                  <button className="btn small ghost" type="submit">İptal</button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
