"use client";

import { useState } from "react";
import { AttractionCard } from "@/components/guide/AttractionCard";
import { attractions } from "@/data/attractions";
import { sessionGaps } from "@/data/sessionGaps";
import {
  getLeaveDeadline,
  isRainAwareReorder,
  itineraryFitsGap,
  sortAttractionsForWeather,
} from "@/lib/guideUtils";
import { getGapWindow } from "@/lib/sepangSchedule";
import type { Session } from "@/types";

const MAX_ITINERARY = 3;

interface GuidePanelProps {
  session: Session;
  rainProbability: number;
}

export function GuidePanel({ session, rainProbability }: GuidePanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const gap = sessionGaps.find((item) => item.afterSession === session);
  if (!gap) return null;

  const picks = attractions.filter((attraction) =>
    gap.recommendedBands.includes(attraction.proximity)
  );
  const ordered = sortAttractionsForWeather(picks, rainProbability);
  const rainReorder = isRainAwareReorder(rainProbability);
  const gapWindow = getGapWindow(session);
  const selected = ordered.filter((item) => selectedIds.includes(item.id));
  const itinerary = itineraryFitsGap(selected, gap, gapWindow?.budgetMinutes ?? null);

  function toggle(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_ITINERARY) return current;
      return [...current, id];
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-paper-dim">
          Between sessions
        </p>
        <h2 className="mt-2 font-display text-xl uppercase tracking-wide">{gap.label}</h2>
        <p className="mt-2 text-sm text-paper-dim">{gap.blurb}</p>
        {rainReorder ? (
          <p className="mt-2 text-xs text-amber">
            Rain risk {Math.round(rainProbability)}% — indoor and near-circuit picks surfaced first.
          </p>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 ${
            itinerary.fits ? "border-paper/10 bg-asphalt" : "border-brick/40 bg-brick/5"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            Your gap plan
          </p>
          <p className="mt-2 text-sm text-paper">{itinerary.message}</p>
          {gapWindow && selected.length === 1 ? (
            <p className="mt-2 font-mono text-[11px] text-amber">
              {(() => {
                const deadline = getLeaveDeadline(session, selected[0].driveTimeMinutes);
                if (!deadline) return null;
                return `Latest departure: ${deadline.toLocaleTimeString("en-MY", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: "Asia/Kuala_Lumpur",
                })}`;
              })()}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3">
        {ordered.map((attraction) => (
          <AttractionCard
            key={attraction.id}
            attraction={attraction}
            afterSession={session}
            selected={selectedIds.includes(attraction.id)}
            rainBoost={rainReorder}
            onToggle={() => toggle(attraction.id)}
          />
        ))}
      </div>
    </section>
  );
}
