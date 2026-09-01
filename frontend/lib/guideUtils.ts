import type { Attraction } from "@/data/attractions";
import type { SessionGap } from "@/data/sessionGaps";
import type { Session } from "@/types";
import { getGapWindow, getLeaveByDeadline } from "@/lib/sepangSchedule";

const RAIN_REORDER_THRESHOLD = 45;

export function sortAttractionsForWeather(
  picks: Attraction[],
  rainProbability: number
): Attraction[] {
  if (rainProbability < RAIN_REORDER_THRESHOLD) return picks;

  const settingRank = (attraction: Attraction): number => {
    switch (attraction.setting) {
      case "indoor":
        return 0;
      case "mixed":
        return 1;
      case "outdoor":
        return 2;
      default: {
        const exhaustive: never = attraction.setting;
        return exhaustive;
      }
    }
  };

  return [...picks].sort((a, b) => {
    const rankDiff = settingRank(a) - settingRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.driveTimeMinutes - b.driveTimeMinutes;
  });
}

export function isRainAwareReorder(rainProbability: number): boolean {
  return rainProbability >= RAIN_REORDER_THRESHOLD;
}

export function itineraryDriveTotal(selected: Attraction[]): number {
  return selected.reduce((sum, item) => sum + item.driveTimeMinutes, 0);
}

function shortName(name: string): string {
  const base = name.split("(")[0].trim();
  const words = base.split(" ");
  return words.length <= 2 ? base : `${words[0]} ${words[1]}`;
}

export function itineraryLabel(selected: Attraction[]): string {
  if (selected.length === 0) return "";
  return selected.map((item) => shortName(item.name)).join(" + ");
}

export function itineraryFitsGap(
  selected: Attraction[],
  gap: SessionGap,
  budgetMinutes: number | null
): { fits: boolean; message: string } {
  if (selected.length === 0) {
    return { fits: true, message: "Tap up to 3 spots to plan this gap." };
  }

  const total = itineraryDriveTotal(selected);
  const label = itineraryLabel(selected);
  const roundTrip = total * 2;

  if (budgetMinutes === null) {
    return {
      fits: true,
      message: `${label}: ${total} min total — overnight gap, no tight window.`,
    };
  }

  const fits = roundTrip <= budgetMinutes;
  const hours = Math.round(budgetMinutes / 60);
  return {
    fits,
    message: fits
      ? `${label}: ${total} min total, fits your ${hours}hr ${gap.label} gap.`
      : `${label}: ${total} min total — ${roundTrip} min round-trip is tight for a ${hours}hr gap.`,
  };
}

export function leaveByLabel(afterSession: Session, driveMinutes: number): string | null {
  const window = getGapWindow(afterSession);
  if (!window) return null;

  const deadline = getLeaveByDeadline(window.nextStartMs, driveMinutes);
  if (!deadline) return null;

  const time = deadline.toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  });

  return `Leave by ${time} to make ${window.nextSession}`;
}

export function leaveCountdownText(deadline: Date | null, now = new Date()): string | null {
  if (!deadline) return null;
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return "Head back now";
  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) return `Leave in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `Leave in ${hours}h ${rem}m` : `Leave in ${hours}h`;
}

export function getLeaveDeadline(afterSession: Session, driveMinutes: number): Date | null {
  const window = getGapWindow(afterSession);
  if (!window) return null;
  return getLeaveByDeadline(window.nextStartMs, driveMinutes);
}
