import type { Metadata } from "next";
import { IngredientList } from "@/components/IngredientList";
import { requireMember } from "@/lib/session";
import type { Ingredient } from "@/lib/types";

export const metadata: Metadata = { title: "Malzeme" };

export default async function IngredientsPage() {
  const { supabase, member } = await requireMember(["owner", "kitchen", "depot"]);
  const { data } = await supabase.from("ingredients").select("*").eq("active", true).order("name");
  return (
    <main className="wrap">
      <h2>Malzeme stoğu</h2>
      <p className="sub">{member.role === "kitchen" ? "Mal gelince malzemeye dokun ve gelen miktarı gir." : "Mal gelince ya da sayım yapınca malzemeye dokun."}</p>
      <IngredientList ingredients={(data ?? []) as Ingredient[]} role={member.role} />
    </main>
  );
}
