import type { Metadata } from "next";
import Link from "next/link";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { getPlaces, requireMember } from "@/lib/session";
import { placeKind } from "@/lib/domain/places";
import { ROLE_LABEL, type Invite, type Member, type Place } from "@/lib/types";
import { addStaff, assignMember, createInvite, deleteInvite, removeMember } from "../_actions/team";

export const metadata: Metadata = { title: "Ekip" };

const date = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" });

function PlaceSelect({ places, id, value, required = true }: { places: Place[]; id: string; value?: string | null; required?: boolean }) {
  return (
    <select className="input" id={id} name="place" required={required} defaultValue={value ?? ""}>
      <option value="">{required ? "Yer seç" : "Atanmadı"}</option>
      {places.map((p) => <option key={p.id} value={p.id}>{p.name} ({placeKind(p)})</option>)}
    </select>
  );
}

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, userId } = await requireMember(["admin"]);
  const sp = await searchParams;
  const [{ data: m }, { data: i }, allPlaces] = await Promise.all([
    supabase.from("members").select("*").order("created_at"),
    supabase.from("invites").select("*").is("used_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    getPlaces(),
  ]);
  const members = (m ?? []) as Member[];
  const invites = (i ?? []) as Invite[];
  const places = allPlaces.filter((p) => p.active);
  const placeName = new Map(allPlaces.map((p) => [p.id, p.name]));
  const fresh = param(sp.code);
  const added = param(sp.added);

  return (
    <>
      <div className="page-head"><h1>Ekip</h1></div>
      <p className="lead">Her çalışan bir yerde çalışır ve sadece o yerin satış, üretim, sevkiyat ve stok ekranlarını görür. Fiyatları, tarifleri, sayımı, yerleri ve ekibi sadece admin yönetir.</p>
      <Alert error={param(sp.error)} info={param(sp.ok)} />

      {!places.length && (
        <p className="alert warn">Çalışan eklemeden önce bir yer ekle. <Link href="/app/places?new=1">Yer ekle</Link></p>
      )}

      {added && (
        <section className="panel notice" aria-live="polite">
          <h2>Çalışan eklendi</h2>
          <p className="lead" style={{ margin: 0 }}>
            <b>{added}</b> adresiyle Stokla&apos;da <b>Kayıt ol</b> demesi yeterli. E-postasını doğrulayıp girince doğrudan seçtiğin yere bağlanır; kod gerekmez. Kayıt 30 gün bekler.
          </p>
        </section>
      )}
      {fresh && (
        <section className="panel notice" style={{ textAlign: "center" }} aria-live="polite">
          <p className="lead" style={{ margin: 0 }}>Davet kodu</p>
          <p className="code">{fresh}</p>
          <p className="lead" style={{ margin: "0 auto", maxWidth: "48ch" }}>Bu kodu çalışanına gönder. Stokla&apos;ya kayıt olup &quot;Davet koduyla katıl&quot; demeli. Kod 7 gün geçerli ve tek kullanımlık.</p>
        </section>
      )}

      {places.length > 0 && (
        <div className="row">
          <form className="panel wide" action={addStaff} aria-labelledby="h-add">
            <h2 id="h-add">Çalışan ekle</h2>
            <div className="fields three">
              <div className="field">
                <label htmlFor="st-name">Adı</label>
                <input className="input" id="st-name" name="name" required maxLength={60} placeholder="Örn. Ayşe" />
              </div>
              <div className="field">
                <label htmlFor="st-email">E-posta</label>
                <input className="input" id="st-email" name="email" type="email" required maxLength={200} placeholder="ayse@ornek.com" autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="st-place">Çalışacağı yer</label>
                <PlaceSelect places={places} id="st-place" />
              </div>
            </div>
            <button className="btn" type="submit">Çalışanı ekle</button>
          </form>
          <form className="panel" action={createInvite} aria-labelledby="h-code">
            <h2 id="h-code">Ya da davet kodu ver</h2>
            <p className="lead" style={{ marginTop: 0 }}>E-postasını bilmiyorsan 6 haneli bir kod oluştur.</p>
            <div className="field">
              <label htmlFor="inv-place">Çalışacağı yer</label>
              <PlaceSelect places={places} id="inv-place" />
            </div>
            <button className="btn secondary" type="submit">Kod oluştur</button>
          </form>
        </div>
      )}

      <div className="row">
        <section className="panel wide" aria-labelledby="h-team">
          <h2 id="h-team">Ekip üyeleri</h2>
          <ul className="list">
            {members.map((x) => (
              <li key={x.user_id} className="member">
                <span className={`avatar ${x.role}`} aria-hidden="true">{x.name.charAt(0).toLocaleUpperCase("tr-TR")}</span>
                <span className="grow">
                  <b>{x.name}{x.user_id === userId ? " (sen)" : ""}</b>
                  <small>{x.role === "admin" ? `${ROLE_LABEL.admin}, tüm yerler` : `${ROLE_LABEL.employee}, ${x.location_id ? placeName.get(x.location_id) ?? "?" : "henüz bir yere atanmadı"}`}</small>
                </span>
                {x.role === "employee" && places.length > 0 && (
                  <form action={assignMember} className="inline-form">
                    <input type="hidden" name="user_id" value={x.user_id} />
                    <label className="sr-only" htmlFor={`as-${x.user_id}`}>{x.name} hangi yerde çalışıyor</label>
                    <PlaceSelect places={places} id={`as-${x.user_id}`} value={x.location_id} required={false} />
                    <button className="btn small secondary" type="submit">Taşı</button>
                  </form>
                )}
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
          <h2 id="h-invites">Katılması beklenenler</h2>
          {invites.length ? (
            <ul className="list">
              {invites.map((x) => (
                <li key={x.code}>
                  <span className="grow">
                    {x.email ? <b>{x.name ?? x.email}</b> : <b style={{ letterSpacing: ".14em" }}>{x.code}</b>}
                    <small>{[x.email, x.location_id ? placeName.get(x.location_id) : null, `${date(x.expires_at)} tarihine kadar`].filter(Boolean).join(" · ")}</small>
                  </span>
                  <form action={deleteInvite}>
                    <input type="hidden" name="code" value={x.code} />
                    <button className="btn small secondary" type="submit">İptal et</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className="empty">Bekleyen kimse yok.</p>}
        </section>
      </div>
    </>
  );
}
