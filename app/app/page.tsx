import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";
import { ROLE_NAV } from "@/lib/types";

export default async function AppHome() {
  const { member } = await requireMember();
  redirect(ROLE_NAV[member.role][0].href);
}
