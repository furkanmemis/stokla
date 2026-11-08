"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  if (tabs.length < 2) return null;
  return (
    <nav className="tabs" aria-label="Bölümler">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`tab ${path.startsWith(t.href) ? "on" : ""}`} aria-current={path.startsWith(t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
