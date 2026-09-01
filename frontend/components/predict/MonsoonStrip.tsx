import type { WeatherSnapshot } from "@/types";

interface MonsoonStripProps {
  weather: WeatherSnapshot;
}

export function MonsoonStrip({ weather }: MonsoonStripProps) {
  const hourly = weather.hourlyRain ?? [];
  if (!weather.monsoonNote && hourly.length === 0) return null;

  return (
    <section className="rounded-lg border border-paper/10 bg-asphalt px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
        Monsoon watch
      </p>
      {weather.monsoonNote ? (
        <p className="mt-2 text-sm text-amber">{weather.monsoonNote}</p>
      ) : null}
      {hourly.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {hourly.map((point) => (
            <div
              key={point.hourLabel}
              className="min-w-[3.5rem] rounded-md border border-paper/10 px-2 py-1.5 text-center"
            >
              <p className="font-mono text-[10px] text-paper-dim">{point.hourLabel}</p>
              <p
                className={`font-mono text-xs ${
                  point.rainProbability >= 55 ? "text-amber" : "text-paper"
                }`}
              >
                {Math.round(point.rainProbability)}%
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
