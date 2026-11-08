import type { IconName } from "@/lib/types";

// Stroke icons for the menu. Decorative: the link text carries the meaning.
const PATHS: Record<IconName | "barcode" | "search" | "close", string> = {
  overview: "M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-4H4z",
  sales: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  production: "M4 20h16M6 20V10l6-4 6 4v10M10 20v-5h4v5",
  pool: "M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM2 10l3-6h14l3 6M9 14h6",
  places: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  stock: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
  catalog: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
  team: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  movements: "M4 6h16M4 12h10M4 18h6M17 15l3 3-3 3",
  barcode: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  close: "M6 6l12 12M18 6 6 18",
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
