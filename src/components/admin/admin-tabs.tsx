"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export function AdminTabs({ base, tabs }: { base: string; tabs: { key: string; label: string }[] }) {
  const active = useSelectedLayoutSegment();
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 lg:flex-wrap">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`${base}/${tab.key}`}
          aria-current={active === tab.key ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
            active === tab.key ? "border-accent font-medium" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
