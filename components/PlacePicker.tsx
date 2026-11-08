"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { choosePlace } from "@/app/app/_actions/places";
import { placeKind } from "@/lib/domain/places";
import type { Place } from "@/lib/types";

type Option = Pick<Place, "id" | "name" | "can_produce" | "can_sell">;

/**
 * Shows which place a screen works at. Admins can switch between the places that fit the screen;
 * employees just see their own.
 */
export function PlacePicker({ current, options, canSwitch }: { current: Option; options: Option[]; canSwitch: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canSwitch || options.length < 2) {
    return <span className="place-chip" title={placeKind(current)}>{current.name}</span>;
  }
  return (
    <label className="place-pick">
      <span className="sr-only">Yer</span>
      <select value={current.id} disabled={pending} aria-label="Yer seç"
        onChange={(e) => { const id = e.target.value; start(async () => { await choosePlace(id); router.refresh(); }); }}>
        {options.map((p) => <option key={p.id} value={p.id}>{p.name} ({placeKind(p)})</option>)}
      </select>
    </label>
  );
}
