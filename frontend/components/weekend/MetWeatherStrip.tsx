"use client";

import {
  formatMetDate,
  MET_FORECAST_URL,
  normalizeMetForecast,
  type MetDay,
} from "@/lib/metWeather";
import { useVisibleFeed } from "@/lib/useVisibleFeed";

export function MetWeatherStrip() {
  const feed = useVisibleFeed<MetDay[]>(
    "met-sepang",
    MET_FORECAST_URL,
    normalizeMetForecast,
    5 * 60_000,
  );

  const today = feed.data?.[0] ?? null;

  return (
    <section className="min-w-0 w-full overflow-hidden border border-asphalt-line bg-pit-carbon/60 px-4 py-5 sm:px-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper-dim">
            Sepang weather · MET Malaysia
          </p>
          <h2 className="mt-1 font-display text-2xl uppercase tracking-wide text-paper">
            District forecast
          </h2>
        </div>
        <button
          type="button"
          onClick={() => feed.refresh()}
          disabled={feed.loading}
          className="min-h-9 font-mono text-[11px] uppercase tracking-wide text-amber hover:text-paper disabled:opacity-50"
        >
          {feed.loading ? "Updating…" : "Refresh"}
        </button>
      </div>

      {today ? (
        <>
          <p className="mt-4 font-mono text-3xl tabular-nums text-paper">
            {today.minTemp}–{today.maxTemp}°C
          </p>
          <p className="mt-1 text-sm text-paper-dim">
            {formatMetDate(today.date)} · {today.summary}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px] uppercase tracking-wide">
            {(
              [
                ["Morning", today.morning],
                ["Afternoon", today.afternoon],
                ["Night", today.night],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="border border-asphalt-line px-2 py-2">
                <dt className="text-paper-dim">{label}</dt>
                <dd className="mt-1 normal-case tracking-normal text-paper">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {feed.data?.slice(0, 7).map((day) => (
              <div
                key={day.date}
                className={`min-w-[4.25rem] border px-2 py-2 text-center font-mono text-[10px] ${
                  day.date === today.date
                    ? "border-amber text-amber"
                    : "border-asphalt-line text-paper-dim"
                }`}
              >
                <div>
                  {new Date(`${day.date}T12:00:00+08:00`).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Kuala_Lumpur",
                    weekday: "short",
                  })}
                </div>
                <div className="mt-1 text-sm tabular-nums text-paper">{day.maxTemp}°</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-paper-dim">
          {feed.loading ? "Loading MET forecast…" : feed.error || "No forecast published yet."}
        </p>
      )}

      {feed.error && today ? (
        <p className="mt-3 font-mono text-[10px] text-brick">Cached read · {feed.error}</p>
      ) : null}

      <p className="mt-4 font-mono text-[10px] text-paper-dim/70">
        data.gov.my · Sepang (Ds064) · district forecast, not trackside sensors
        {feed.retrieved
          ? ` · checked ${new Date(feed.retrieved).toLocaleTimeString("en-GB", {
              timeZone: "Asia/Kuala_Lumpur",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })} MYT`
          : ""}
      </p>
    </section>
  );
}
