"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/predict", label: "Predict" },
  { href: "/circuit", label: "Circuit" },
  { href: "/drivers", label: "Drivers" },
  { href: "/teams", label: "Teams" },
  { href: "/news", label: "News" },
  { href: "/telemetry", label: "Telemetry" },
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
        className="mx-auto flex max-w-md items-center gap-3 px-4 py-3 sm:max-w-5xl sm:gap-4 sm:px-6"
      >
        <Link
          href="/"
          className="shrink-0 font-display text-lg uppercase tracking-wide text-paper"
        >
          Jalur APEXGP
        </Link>
        {/* min-w-0 is load-bearing on a flex child: without it this can't
            shrink below its content width, so overflow-x-auto never
            engages and the nav (now 8 items) pushes the whole page wider
            than the viewport on mobile instead of scrolling in place. */}
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto sm:flex-none sm:justify-end">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap font-mono text-xs transition-colors ${
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
