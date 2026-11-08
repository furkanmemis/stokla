import type { Metadata } from "next";
import Link from "next/link";
import { Alert, param, type SearchParams } from "@/components/Alert";
import { getPlaces, requireMember } from "@/lib/session";
import { placeKind } from "@/lib/domain/places";
import { slicePage } from "@/lib/domain/paging";
import { Pager } from "@/components/Pager";
import type { Member, Place } from "@/lib/types";
import { savePlace, setPlaceActive } from "../_actions/places";

export const metadata: Metadata = { title: "Yerler" };

export default async function PlacesPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireMember(["admin"]);
  const sp = await searchParams;
  const places = await getPlaces();
  const { data: team } = await supabase.from("members").select("location_id").eq("role", "employee");
  const staff = new Map<string, number>();
  for (const m of (team ?? []) as Pick<Member, "location_id">[]) if (m.location_id) staff.set(m.location_id, (staff.get(m.location_id) ?? 0) + 1);

  const editId = param(sp.edit);
  const editing = places.find((p) => p.id === editId) ?? null;
  const showForm = !!editing || param(sp.new) === "1" || !places.length;
  // Producing places first (they fill the pool), then places that only sell.
  const ordered = [...places.filter((p) => p.can_produce), ...places.filter((p) => !p.can_produce)];
  const shown = slicePage(ordered, param(sp.page), 15);

  return (
    <>
      <div className="page-head">
        <h1>Yerler</h1>
        {!showForm && <Link className="btn" href="/app/places?new=1">Yer ekle</Link>}
      </div>
      <p className="lead">Bir yer üretim yapar, satış yapar ya da ikisini birden. Üretilen her şey ortak ürün havuzuna girer; satış yapan yerler vitrinlerine havuzdan alır. Malzeme stoğu her yerde ayrı tutulur.</p>
      <Alert error={param(sp.error)} info={param(sp.ok)} />

      <div className="split">
        <div className="main">
          {ordered.length ? (<>
            <ul className="places">
              {shown.items.map((p) => (
                <li key={p.id} className={`panel place ${p.active ? "" : "closed"}`}>
                  <div className="place-head">
                    <b>{p.name}</b>
                    <span className={`tag ${p.can_produce && p.can_sell ? "kind-production" : p.can_produce ? "kind-count" : "kind-sale"}`}>{placeKind(p)}</span>
                    {!p.active && <span className="tag kind-waste">Kapalı</span>}
                  </div>
                  <small className="lead">
                    {[p.address, `${staff.get(p.id) ?? 0} çalışan`].filter(Boolean).join(" · ")}
                  </small>
                  <div className="place-actions">
                    <Link className="btn small secondary" href={`/app/places?edit=${p.id}`}>Düzenle</Link>
                    <form action={setPlaceActive}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={String(!p.active)} />
                      <button className="btn small secondary" type="submit">{p.active ? "Kapat" : "Yeniden aç"}</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={shown.page} basePath="/app/places" params={{ edit: param(sp.edit) }} /></>
          ) : <p className="panel empty">Henüz yer yok. İlk yerini ekle; örneğin hem üreten hem satan merkez dükkânın.</p>}
        </div>

        {showForm && <PlaceForm editing={editing} places={places} />}
      </div>
    </>
  );
}

function PlaceForm({ editing, places }: { editing: Place | null; places: Place[] }) {
  return (
    <form className="panel place-form" action={savePlace} aria-labelledby="place-form-title">
      <h2 id="place-form-title">{editing ? `${editing.name} düzenle` : "Yeni yer"}</h2>
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <div className="field">
        <label htmlFor="pl-name">Yerin adı</label>
        <input className="input" id="pl-name" name="name" required maxLength={60} defaultValue={editing?.name ?? ""} placeholder="Örn. Çarşı Şube" />
      </div>
      <div className="field">
        <label htmlFor="pl-address">Adres <span className="hint">(isteğe bağlı)</span></label>
        <input className="input" id="pl-address" name="address" maxLength={160} defaultValue={editing?.address ?? ""} placeholder="Örn. Cumhuriyet Cad. 12" />
      </div>
      <fieldset className="field checks">
        <legend>Bu yer ne yapıyor?</legend>
        <label><input type="checkbox" name="can_produce" defaultChecked={editing ? editing.can_produce : false} /> Üretim yapıyor</label>
        <label><input type="checkbox" name="can_sell" defaultChecked={editing ? editing.can_sell : true} /> Satış yapıyor</label>
      </fieldset>
      <div className="place-actions">
        <button className="btn" type="submit">{editing ? "Kaydet" : "Yeri ekle"}</button>
        {places.length > 0 && <Link className="btn secondary" href="/app/places">Vazgeç</Link>}
      </div>
    </form>
  );
}
