"use client";

import { useEffect, useState } from "react";
import { fetchSepangAccess } from "@/lib/api";
import type { SepangAccessPayload } from "@/types/transit";

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kuala_Lumpur",
    });
  } catch {
    return iso;
  }
}

/**
 * Live RapidKL (Prasarana) transit read toward the Sepang/KLIA corridor —
 * real data.gov.my GTFS feeds, not an F1- or circuit-operated shuttle.
 * `coverage_note` from the API is always shown, unabridged: it's the
 * honest "here's exactly what this can and can't show" line (no route
 * reaches the circuit gate itself; no official 2026 race shuttle exists
 * yet), the same standard as this app's other real-data surfaces. An
 * empty live-vehicle list is a legitimate "nothing running right now"
 * read, not an error state — see backend/app/services/transit_service.py.
 */
export function TransitAccessPanel() {
  const [data, setData] = useState<SepangAccessPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSepangAccess()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
        Live transit unavailable — the RapidKL feed didn&apos;t respond.
      </p>
    );
  }

  if (!data) {
    return (
      <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
        Checking live RapidKL positions…
      </p>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-paper/10 bg-asphalt px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
        Public transit toward Sepang/KLIA · via RapidKL (data.gov.my)
      </p>
      <p className="mt-2 text-xs leading-relaxed text-paper-dim">{data.coverage_note}</p>

      {data.live_vehicles.length > 0 ? (
        <ol className="mt-3 space-y-2">
          {data.live_vehicles.map((vehicle) => (
            <li
              key={vehicle.vehicle_id}
              className="flex items-baseline justify-between gap-3 font-mono text-xs text-paper"
            >
              <span>
                {vehicle.route_name} → {vehicle.nearest_stop.name}
                {vehicle.eta_method === "fallback_speed" ? (
                  <span className="ml-1.5 text-paper-dim/70">(est.)</span>
                ) : null}
              </span>
              <span className="whitespace-nowrap text-amber">
                {vehicle.eta_minutes.toFixed(0)} min · {vehicle.distance_km.toFixed(1)} km
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-paper-dim/70">
        As of {formatClock(data.generated_at)} MYT
      </p>

      <div className="mt-4 space-y-3 border-t border-paper/10 pt-3">
        {data.historical_shuttle.map((note) => (
          <div key={note.label}>
            <p className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
              {note.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-paper-dim">{note.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
