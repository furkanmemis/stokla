import Link from "next/link";
import { Mark } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { memberPlace, requireMember } from "@/lib/session";
import { navFor } from "@/lib/domain/places";
import { ROLE_LABEL } from "@/lib/types";
import { signOut } from "../_actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { member, business } = await requireMember();
  const place = await memberPlace(member);
  const initial = member.name.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Link href="/app" className="brand"><Mark size={30} />Stokla</Link>
          <span className="shop-name">{business.name}{place ? ` · ${place.name}` : ""}</span>
          <form action={signOut} className="signout-top"><button className="signout" type="submit">Çıkış</button></form>
        </div>
        <Nav items={navFor(member.role, place)} />
        <div className="me">
          <span className={`avatar ${member.role}`} aria-hidden="true">{initial}</span>
          <span className="me-text"><b>{member.name}</b><span>{ROLE_LABEL[member.role]}{place ? `, ${place.name}` : ""}</span></span>
          <form action={signOut}><button className="signout" type="submit">Çıkış</button></form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
