import { MetWeatherStrip } from "@/components/weekend/MetWeatherStrip";
import { MyWeekendChecklist } from "@/components/weekend/MyWeekendChecklist";
import { SessionCountdown } from "@/components/weekend/SessionCountdown";

/** Landing-page weekend companion strip: MYT countdown + .ics, MET weather, checklist. */
export function WeekendHub() {
  return (
    <section
      id="weekend"
      className="relative z-20 mx-auto w-full min-w-0 max-w-5xl space-y-4 px-4 py-10 sm:px-6 sm:py-14"
    >
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-pit-lime">
          Race weekend hub
        </p>
        <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-paper sm:text-4xl">
          Countdown, weather, plan
        </h2>
        <p className="mt-2 text-sm text-paper-dim md:text-base">
          Live MYT session clock, MET Malaysia district forecast, and a
          browser-local checklist — no login.
        </p>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <SessionCountdown />
        </div>
        <div className="min-w-0">
          <MetWeatherStrip />
        </div>
      </div>
      <MyWeekendChecklist />
    </section>
  );
}
