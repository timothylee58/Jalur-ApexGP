"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

const EDGE_EPSILON = 4;

export function SiteHeader() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ back: false, forward: false });

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      back: el.scrollLeft > EDGE_EPSILON,
      forward: el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_EPSILON,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  // Bring the current page's link into view — on a narrow screen "Seats" or
  // "Calendar" would otherwise be active but scrolled out of sight.
  useEffect(() => {
    const el = scrollerRef.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active) return;
    const target = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "auto" });
    measure();
  }, [pathname, t, measure]);

  const page = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: reduce ? "auto" : "smooth" });
  };

  // Fade whichever edge still has content beyond it, so the row reads as
  // "there's more this way" instead of text sliced mid-word.
  const mask = `linear-gradient(to right, ${edges.back ? "transparent 0, #000 2.5rem" : "#000 0"}, ${
    edges.forward ? "#000 calc(100% - 2.5rem), transparent 100%" : "#000 100%"
  })`;

  return (
    <header className="relative z-20 border-b border-paper/10 bg-asphalt/80 backdrop-blur">
      <nav
        aria-label={t.header.primaryNav}
        className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-6"
      >
        <Link
          href="/"
          className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          <img
            src="/brand/jalur-apexgp.png"
            alt="Jalur APEXGP"
            width={460}
            height={180}
            className="h-6 w-auto object-contain"
            decoding="async"
          />
        </Link>

        <div className="relative flex min-w-0 flex-1 items-center">
          <ScrollButton
            direction={-1}
            visible={edges.back}
            label={t.header.scrollBack}
            onClick={() => page(-1)}
          />
          {/* min-w-0 is load-bearing on a flex child: without it this can't
              shrink below its content width, so it would push the page wider
              instead of scrolling. The native scrollbar is hidden (it drew a
              bright bar across the header on Windows); the fades and arrow
              buttons are the affordance instead, and touch/trackpad/Shift+
              wheel scrolling all still work. */}
          <div
            ref={scrollerRef}
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ maskImage: mask, WebkitMaskImage: mask }}
          >
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber ${
                    active ? "bg-amber/10 text-amber" : "text-paper-dim hover:bg-paper/5 hover:text-paper"
                  }`}
                >
                  {t.nav[item.key]}
                </Link>
              );
            })}
          </div>
          <ScrollButton
            direction={1}
            visible={edges.forward}
            label={t.header.scrollForward}
            onClick={() => page(1)}
          />
        </div>

        <div className="shrink-0 border-l border-paper/10 pl-2 sm:pl-3">
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}

function ScrollButton({
  direction,
  visible,
  label,
  onClick,
}: {
  direction: 1 | -1;
  visible: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === 1 ? ChevronRight : ChevronLeft;
  // Kept out of the tab order: keyboard users reach every link by Tab
  // anyway (focus scrolls it into view), so these are pointer shortcuts.
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-paper-dim transition-opacity hover:bg-paper/10 hover:text-paper sm:flex ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
