import { redirect } from "next/navigation";
import { memberPlace, requireMember } from "@/lib/session";
import { homeFor } from "@/lib/domain/places";

export default async function AppHome() {
  const { member } = await requireMember();
  redirect(homeFor(member.role, await memberPlace(member)));
}
