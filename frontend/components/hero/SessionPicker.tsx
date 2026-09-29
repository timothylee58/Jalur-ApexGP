"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Dictionary } from "@/lib/i18n/types";
import { getLiveOrNextSession, getLiveSessionWindow, SEPANG_2026_SESSIONS } from "@/lib/sepangSchedule";
import { cn } from "@/lib/utils";
import type { Session } from "@/types";

interface SessionPickerProps {
  className?: string;
}

// Read the MYT wall-clock straight out of the schedule's "+08:00" ISO
// strings rather than via Intl + timeZone: identical on server and client
// (no ICU differences to cause a hydration mismatch), and the time shown
// is the circuit's local time whatever the visitor's own zone is.
function slotLabel(iso: string, t: Dictionary["hero"]) {
  const [, y, m, d, hhmm] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(iso) ?? [];
  const weekday = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
  return {
    day: t.dateFormat
      .replace("{weekday}", t.weekdays[weekday])
      .replace("{day}", String(Number(d)))
      .replace("{month}", t.months[Number(m) - 1]),
    time: hhmm,
  };
}

type Status = { session: Session; live: boolean } | null;

export function SessionPicker({ className }: SessionPickerProps) {
  const { t } = useLanguage();
  // Resolved after mount: "next" depends on the visitor's clock, and a
  // server-rendered guess would disagree with the client near a boundary.
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const live = getLiveSessionWindow(now);
      const last = SEPANG_2026_SESSIONS[SEPANG_2026_SESSIONS.length - 1];
      // Once the weekend is over nothing is "next"; don't point at the Race.
      if (!live && now.getTime() > new Date(last.end).getTime()) return setStatus(null);
      setStatus({ session: live?.session ?? getLiveOrNextSession(now), live: Boolean(live) });
    };
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={cn("w-full max-w-3xl", className)}>
      <p className="mb-2 flex items-baseline justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-dim sm:mb-2.5 sm:justify-start sm:tracking-[0.2em]">
        <span>{t.hero.pickSession}</span>
        <span className="shrink-0 text-paper-dim/60">MYT · UTC+8</span>
      </p>
      {/* Mobile: 3 + 2 on a six-column grid, so every card is a full
          thumb-sized target and nothing is orphaned. sm+: one row of five. */}
      <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-5 sm:gap-2">
        {SEPANG_2026_SESSIONS.map((slot, index) => {
          const { day, time } = slotLabel(slot.start, t.hero);
          const flagged = status?.session === slot.session;
          const name = t.hero.sessionNames[slot.session];
          return (
            <motion.li
              key={slot.session}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.45 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className={cn(index < 3 ? "col-span-2" : "col-span-3", "sm:col-span-1")}
            >
              <Link
                href={`/predict?session=${slot.session}`}
                aria-label={`${t.hero.runStrategy.replace("{session}", name)} — ${day}, ${time} MYT${
                  flagged ? ` (${status?.live ? t.hero.live : t.hero.next})` : ""
                }`}
                className={cn(
                  "group relative flex h-full flex-col rounded-lg border px-3 pb-2.5 pt-2 backdrop-blur-sm transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt",
                  "hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                  flagged
                    ? "border-amber/70 bg-amber/[0.12] hover:bg-amber/20"
                    : "border-paper/15 bg-pit-carbon/60 hover:border-paper/40 hover:bg-pit-carbon/80"
                )}
              >
                <span className="flex items-center justify-between gap-1 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
                  <span className="truncate">{day}</span>
                  {flagged ? (
                    <span className="flex shrink-0 items-center gap-1 text-pit-lime" aria-hidden="true">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pit-lime opacity-70 motion-reduce:animate-none" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pit-lime" />
                      </span>
                      <span className="hidden sm:inline">{status?.live ? t.hero.live : t.hero.next}</span>
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "mt-1 font-display text-2xl leading-none tracking-wide sm:text-3xl",
                    flagged ? "text-amber" : "text-paper"
                  )}
                >
                  {slot.session}
                </span>
                <span className="mt-1.5 flex items-end justify-between gap-1">
                  <span className="min-w-0 text-[11px] leading-tight text-paper-dim">
                    <span className="block truncate">{name}</span>
                    <span className="font-mono text-paper/80">{time}</span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none",
                      flagged ? "text-amber" : "text-paper-dim/60 group-hover:text-paper"
                    )}
                  />
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
