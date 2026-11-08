import { Mark } from "@/components/Logo";
import { Tabs } from "@/components/Tabs";
import { requireMember } from "@/lib/session";
import { ROLE_LABEL, ROLE_TABS } from "@/lib/types";
import { signOut } from "../_actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { member, business } = await requireMember();
  return (
    <>
      <header className="top">
        <div className="top-in">
          <Mark size={30} />
          <span className="shop">{business.name}<small>{member.name} · {ROLE_LABEL[member.role]}</small></span>
          <form action={signOut}><button className="chip" type="submit">Çıkış</button></form>
        </div>
      </header>
      <Tabs tabs={ROLE_TABS[member.role]} />
      {children}
    </>
  );
}
