"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Dictionary } from "@/lib/i18n/types";

// Nav labels are looked up from the language dictionary at render time
// (below) — this array only carries what's language-independent (the
// route + which dictionary key names its label).
const NAV: { href: string; key: keyof Dictionary["nav"] }[] = [
  { href: "/predict", key: "predict" },
  { href: "/picks", key: "picks" },
  { href: "/circuit", key: "circuit" },
  { href: "/accuracy", key: "accuracy" },
  { href: "/drivers", key: "drivers" },
  { href: "/teams", key: "teams" },
  { href: "/fan", key: "fan" },
  { href: "/news", key: "news" },
  { href: "/telemetry", key: "telemetry" },
  { href: "/drive", key: "drive" },
  { href: "/product-reveal", key: "reveal" },
  { href: "/lore", key: "lore" },
  { href: "/guide", key: "guide" },
  { href: "/calendar", key: "calendar" },
  { href: "/tickets", key: "seats" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <header className="relative z-20 border-b border-paper/10 bg-asphalt/80 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6"
      >
        <Link href="/" className="shrink-0">
          <img
            src="/brand/jalur-apexgp.png"
            alt="Jalur APEXGP"
            width={460}
            height={180}
            className="h-6 w-auto object-contain"
            decoding="async"
          />
        </Link>
        {/* min-w-0 is load-bearing on a flex child: without it this can't
            shrink below its content width, so overflow-x-auto never
            engages and the nav pushes the whole page wider than the
            viewport instead of scrolling in place. Deliberately
            scrollable at every breakpoint, not just mobile — 15 nav items
            plus the language switcher can outgrow even an `sm:` desktop
            header width, and `html`'s overflow-x-clip means anything that
            overflows without a scroll affordance is just unreachable, not
            merely ugly (a real bug this used to have via `sm:flex-none`,
            which stopped this row from shrinking right when it needed to
            most). Harmless when everything already fits — overflow-x-auto
            only engages once content actually overflows. */}
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
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
                {t.nav[item.key]}
              </Link>
            );
          })}
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}
