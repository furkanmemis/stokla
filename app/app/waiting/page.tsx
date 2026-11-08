import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { memberPlace, requireMember } from "@/lib/session";
import { WAITING_PATH, homeFor } from "@/lib/domain/places";

export const metadata: Metadata = { title: "Yer bekleniyor" };

/** Where an employee lands when they are not assigned to an open place. */
export default async function WaitingPage() {
  const { member, business } = await requireMember();
  const home = homeFor(member.role, await memberPlace(member));
  if (home !== WAITING_PATH) redirect(home);
  return (
    <section className="panel" style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 26 }}>Henüz bir yere atanmadın</h1>
      <p className="lead">{business.name} ekibindesin, ama çalışacağın yer seçilmemiş ya da kapatılmış. Admin, Ekip bölümünden seni bir yere atayınca satış, üretim ve stok ekranların burada açılır.</p>
    </section>
  );
}
