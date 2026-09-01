"use client";

import { useEffect, useState } from "react";
import { DriveTimeBadge } from "@/components/guide/DriveTimeBadge";
import type { Attraction } from "@/data/attractions";
import { getLeaveDeadline, leaveByLabel, leaveCountdownText } from "@/lib/guideUtils";
import type { Session } from "@/types";

interface AttractionCardProps {
  attraction: Attraction;
  afterSession: Session;
  selected?: boolean;
  rainBoost?: boolean;
  onToggle?: () => void;
}

export function AttractionCard({
  attraction,
  afterSession,
  selected = false,
  rainBoost = false,
  onToggle,
}: AttractionCardProps) {
  const deadline = getLeaveDeadline(afterSession, attraction.driveTimeMinutes);
  const staticLeave = leaveByLabel(afterSession, attraction.driveTimeMinutes);
  const [countdown, setCountdown] = useState(() => leaveCountdownText(deadline));

  useEffect(() => {
    if (!deadline) return;
    const tick = () => setCountdown(leaveCountdownText(deadline));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [deadline]);

  return (
    <article
      className={`overflow-hidden rounded-lg border bg-asphalt transition-colors ${
        selected ? "border-amber" : "border-paper/10"
      }`}
    >
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div
          className="h-28 bg-paper/5 bg-cover bg-center"
          style={
            attraction.imageUrl
              ? { backgroundImage: `url(${attraction.imageUrl})` }
              : undefined
          }
        />
        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold leading-snug text-paper">
              {attraction.name}
            </h3>
            <DriveTimeBadge minutes={attraction.driveTimeMinutes} />
          </div>
          <div className="flex flex-wrap gap-2">
            <p className="text-xs uppercase tracking-wide text-paper-dim">
              {attraction.category}
            </p>
            {rainBoost && attraction.setting === "indoor" ? (
              <span className="font-mono text-[10px] uppercase text-amber">
                Dry pick
              </span>
            ) : null}
          </div>
          <p className="text-sm text-paper-dim">{attraction.description}</p>
          {staticLeave ? (
            <p className="font-mono text-[11px] text-amber">
              {staticLeave}
              {countdown ? ` · ${countdown}` : null}
            </p>
          ) : null}
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
            {selected ? "Selected · tap to remove" : "Tap to add to itinerary"}
          </p>
        </div>
      </button>
    </article>
  );
}
