import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";
import { ROLE_TABS } from "@/lib/types";

export default async function AppHome() {
  const { member } = await requireMember();
  redirect(ROLE_TABS[member.role][0].href);
}
