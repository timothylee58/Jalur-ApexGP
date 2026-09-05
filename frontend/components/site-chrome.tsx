"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/predict", label: "Predict" },
  { href: "/circuit", label: "Circuit" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/apple-design", label: "Reveal" },
  { href: "/lore", label: "Lore" },
  { href: "/tickets", label: "Seats" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="relative z-20 border-b border-paper/10 bg-asphalt/80 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-3 sm:max-w-5xl sm:px-6"
      >
        <Link href="/" className="font-display text-lg uppercase tracking-wide text-paper">
          Jalur APEXGP
        </Link>
        <div className="flex items-center gap-4">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`font-mono text-xs transition-colors ${
                  active ? "text-amber" : "text-paper-dim hover:text-paper"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
