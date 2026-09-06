"use client";

import { useEffect, useState } from "react";
import { downloadWeekendIcs } from "@/lib/ics";
import { SEPANG_2026_SESSIONS } from "@/lib/sepangSchedule";

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function split(ms: number): Parts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function formatMyt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function SessionCountdown() {
  // Null until mount so SSR HTML matches the first client paint — ticking
  // values only appear after hydration (avoids seconds mismatch).
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clock = now ?? 0;
  const live =
    now == null
      ? undefined
      : SEPANG_2026_SESSIONS.find(
          (s) => Date.parse(s.start) <= clock && Date.parse(s.end) > clock,
        );
  // SSR/pre-hydration: show the first session label only (stable). After
  // mount, resolve live/next against the real clock.
  const next =
    now == null
      ? SEPANG_2026_SESSIONS[0]
      : (live ?? SEPANG_2026_SESSIONS.find((s) => Date.parse(s.start) > clock));
  const targetMs = next
    ? live
      ? Date.parse(next.end)
      : Date.parse(next.start)
    : null;
  const parts =
    now != null && targetMs != null ? split(targetMs - clock) : null;


  return (
    <section className="min-w-0 w-full overflow-hidden border border-asphalt-line bg-pit-carbon/60 px-4 py-5 sm:px-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-pit-lime">
            {live ? "Live session window · MYT" : "Next session · MYT"}
          </p>
          <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-paper sm:text-4xl">
            {next?.session ?? "Weekend complete"}
          </h2>
          {next ? (
            <p className="mt-1 font-mono text-xs text-paper-dim">
              {live ? "Ends" : "Starts"} {formatMyt(live ? next.end : next.start)} MYT
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => downloadWeekendIcs()}
          className="min-h-10 w-full shrink-0 border border-amber/40 px-3 font-mono text-[11px] uppercase tracking-wide text-amber hover:bg-amber/10 sm:w-auto"
        >
          Add weekend to calendar (.ics)
        </button>
      </div>

      {parts ? (
        <div
          className="mt-5 grid w-full min-w-0 grid-cols-4 gap-2 font-mono sm:max-w-md"
          aria-live="off"
        >
          {(
            [
              ["days", parts.days],
              ["hours", parts.hours],
              ["mins", parts.minutes],
              ["secs", parts.seconds],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="border border-asphalt-line bg-asphalt px-2 py-3 text-center"
            >
              <strong className="block text-2xl tabular-nums text-paper sm:text-3xl">
                {String(value).padStart(2, "0")}
              </strong>
              <span className="text-[10px] uppercase tracking-wide text-paper-dim">
                {label}
              </span>
            </div>
          ))}
        </div>
      ) : next ? (
        <div
          className="mt-5 grid w-full min-w-0 grid-cols-4 gap-2 font-mono sm:max-w-md"
          aria-hidden
        >
          {(["days", "hours", "mins", "secs"] as const).map((label) => (
            <div
              key={label}
              className="border border-asphalt-line bg-asphalt px-2 py-3 text-center"
            >
              <strong className="block text-2xl tabular-nums text-paper/30 sm:text-3xl">
                --
              </strong>
              <span className="text-[10px] uppercase tracking-wide text-paper-dim">
                {label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-paper-dim">
          No upcoming Sepang session on the 2026 timetable.
        </p>
      )}

      <ol className="mt-5 flex gap-2 overflow-x-auto pb-1 font-mono text-[10px] uppercase tracking-wide text-paper-dim [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
        {SEPANG_2026_SESSIONS.map((session) => {
          const active = session.session === next?.session;
          return (
            <li
              key={session.session}
              className={`shrink-0 border px-2.5 py-1.5 ${
                active
                  ? "border-amber text-amber"
                  : "border-asphalt-line text-paper-dim"
              }`}
            >
              {session.session}
              <span className="ml-2 opacity-70">
                {new Date(session.start).toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Kuala_Lumpur",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
