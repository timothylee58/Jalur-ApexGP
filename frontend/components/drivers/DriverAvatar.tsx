"use client";

import { useState } from "react";
import { inkForAccent } from "@/lib/driverAccent";
import { photoForDriver } from "@/lib/driverPhotos";

interface DriverAvatarProps {
  driverId: string;
  initials: string;
  number?: number | null;
  /** Constructor accent hex (ring + number badge). */
  accent?: string;
  accentSecondary?: string;
  active?: boolean;
  size?: "sm" | "lg";
}

/**
 * Driver headshot in a constructor-color ring, with race-number badge.
 * Falls back to initials on the accent shell if the photo fails to load.
 */
export function DriverAvatar({
  driverId,
  initials,
  number = null,
  accent = "#a39b8f",
  accentSecondary = "#2a3036",
  active = false,
  size = "sm",
}: DriverAvatarProps) {
  const photo = photoForDriver(driverId);
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(photo) && !broken;
  const box = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const badge = size === "lg" ? "h-6 min-w-6 px-1 text-[11px]" : "h-4 min-w-4 px-0.5 text-[9px]";
  const ink = inkForAccent(accent);
  const label = number !== null ? String(number) : initials.slice(0, 2);

  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center ${box} ${
        active ? "drop-shadow-[0_0_10px_rgba(245,166,35,0.6)]" : ""
      }`}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: `linear-gradient(145deg, ${accent}, ${accentSecondary})`,
          padding: size === "lg" ? 3 : 2,
        }}
      />
      <span
        className={`relative flex h-[86%] w-[86%] items-center justify-center overflow-hidden rounded-full ${
          showPhoto ? "bg-asphalt" : ""
        }`}
        style={
          showPhoto
            ? undefined
            : {
                background: `linear-gradient(160deg, ${accent}cc, ${accentSecondary})`,
                color: ink,
              }
        }
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- local static headshots
          <img
            src={photo!}
            alt=""
            className="h-full w-full object-cover object-top"
            onError={() => setBroken(true)}
            draggable={false}
          />
        ) : (
          <span className="font-mono text-[0.65em] font-bold uppercase tracking-wide">
            {initials}
          </span>
        )}
      </span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full font-mono font-bold leading-none ${badge}`}
        style={{
          backgroundColor: accent,
          color: ink,
          boxShadow: active ? "0 0 0 1.5px #f5a623" : "0 0 0 1px rgba(10,12,14,0.85)",
        }}
      >
        {label}
      </span>
    </span>
  );
}
