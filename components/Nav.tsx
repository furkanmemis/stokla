"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/types";
import { Icon } from "./Icon";

/** Main menu: a vertical sidebar on wide screens, a horizontal scroller under the top bar on phones. */
export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Ana menü">
      {items.map((item) => {
        const current = path === item.href || path.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
