"use client";

import { useState } from "react";
import { SepangCircuitMap, type StandMarker } from "@/components/circuit/SepangCircuitMap";
import { circuitCenter, pointForName } from "@/data/sepangCircuit";

const ORGANISER_URL = "https://www.sepangcircuit.com/home";

interface Stand {
  id: string;
  name: string;
  /** MYR 3-day price for Malaysian MyKad holders, or null if sold out. */
  priceMyr: number | null;
  kind: "grandstand" | "hillstand";
  /** Corner code shown on the map (T1-15) and a real apex-point name
   * (sepangCircuit.ts) for its actual position — verified against each
   * stand's own page on sepangcircuit.com and motogpsepang.com's/
   * malaysiaticketsgp.com's grandstand-map pages, not guessed. Null when
   * the stand doesn't overlook a specific numbered corner. */
  cornerLabel: string | null;
  apexPoint: string | null;
  description: string;
}

const STANDS: Stand[] = [
  {
    id: "main",
    name: "Main Grandstand",
    priceMyr: 2083.4,
    kind: "grandstand",
    cornerLabel: "T15",
    apexPoint: "Start/Finish",
    description:
      "Seated, rooftop viewing. North side takes in the start/finish straight, pit entry and exit, and the team pit boxes; the south side looks over the back straight into the final corner.",
  },
  {
    id: "k1",
    name: "K1 Grandstand",
    priceMyr: null,
    kind: "grandstand",
    cornerLabel: "T1–T2",
    apexPoint: "T1 Apex",
    description: "Turns 1 and 2 — the best seat for the race start and first-corner overtakes.",
  },
  {
    id: "k2",
    name: "K2 Hillstand",
    priceMyr: 809.6,
    kind: "hillstand",
    cornerLabel: "T3–T4",
    apexPoint: "T3 Apex",
    description:
      "Grass hillstand overlooking Turns 3 and 4 — braking, cornering, and overtakes through this sweeping section. Malaysian MyKad holders only.",
  },
  {
    id: "f",
    name: "F Grandstand",
    priceMyr: null,
    kind: "grandstand",
    cornerLabel: "T5–T7",
    apexPoint: "T6 Apex",
    description:
      "Seated grandstand along the esses, seeing more corners than any other stand — the hairpin complex plus long stretches of both the main and back straights from its centre.",
  },
  {
    id: "c",
    name: "C Hillstand",
    priceMyr: 809.6,
    kind: "hillstand",
    cornerLabel: "T9–T11",
    apexPoint: "T10 Apex",
    description:
      "Grass, open-air, with a long canopy for shade. Panoramic view of the technical mid-sector (Turns 9–11) and the high-speed run onto the back straight.",
  },
  {
    id: "b",
    name: "B Hillstand",
    priceMyr: null,
    kind: "hillstand",
    cornerLabel: "T12–T14",
    apexPoint: "T13 Apex",
    description: "Grass, open-air. Turns 12–14 toward the end of the lap.",
  },
  {
    id: "g",
    name: "G Hillstand",
    priceMyr: 200,
    kind: "hillstand",
    cornerLabel: null,
    apexPoint: null,
    description:
      "Grass, open-air — the budget entry point, general admission with no fixed corner view. Malaysian MyKad holders only; not sold to international fans.",
  },
];

function formatMyr(value: number): string {
  return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SeatFinder() {
  const [selectedId, setSelectedId] = useState<string>("b");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selected = STANDS.find((s) => s.id === selectedId) ?? STANDS[0];

  // Offset each stand out along the centre→apex-point ray — several
  // stands share (or sit very close to) one of the 4 curated
  // circuitMarkers' own points (K1 with T1, F with T5–T7's T6 anchor),
  // and without this they'd render exactly on top of that marker's dot
  // and label.
  const STAND_OFFSET_PX = 42;
  const standMarkers = STANDS.map((s): StandMarker | null => {
    const point = s.apexPoint ? pointForName(s.apexPoint) : undefined;
    if (!point) return null;
    const dx = point.x - circuitCenter.x;
    const dy = point.y - circuitCenter.y;
    const dist = Math.hypot(dx, dy) || 1;
    return {
      id: s.id,
      code: s.id === "main" ? "Main" : s.name.split(" ")[0],
      x: point.x + (dx / dist) * STAND_OFFSET_PX,
      y: point.y + (dy / dist) * STAND_OFFSET_PX,
      kind: s.kind,
      selected: s.id === selectedId,
    };
  }).filter((m): m is StandMarker => m !== null);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="grid grid-cols-2 gap-3">
          {STANDS.map((stand) => {
            const soldOut = stand.priceMyr === null;
            const isSelected = stand.id === selectedId;
            return (
              <button
                key={stand.id}
                type="button"
                onClick={() => setSelectedId(stand.id)}
                aria-pressed={isSelected}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-amber bg-amber/10"
                    : "border-paper/10 bg-asphalt/80 hover:border-paper/30"
                }`}
              >
                <span className="block font-display text-sm uppercase tracking-wide text-paper">
                  {stand.name}
                </span>
                <span
                  className={`mt-1 block font-mono text-xs ${soldOut ? "text-paper-dim" : "text-amber"}`}
                >
                  {soldOut ? "Sold out" : formatMyr(stand.priceMyr!)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-paper/10 bg-asphalt/80 px-4 py-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            {selected.kind === "hillstand" ? "Grass · open air" : "Seated · rooftop"}
          </span>
          <h2 className="mt-1 font-display text-xl uppercase tracking-wide text-paper">
            {selected.name}
          </h2>
          <span
            className={`mt-1 block font-display text-lg uppercase tracking-wide ${
              selected.priceMyr === null ? "text-paper-dim" : "text-amber"
            }`}
          >
            {selected.priceMyr === null ? "Sold out" : `${formatMyr(selected.priceMyr)} · 3 days`}
          </span>
          {selected.cornerLabel ? (
            <span className="mt-1 block font-mono text-xs uppercase tracking-wide text-paper-dim">
              Overlooks {selected.cornerLabel}
            </span>
          ) : null}
          <p className="mt-3 text-sm leading-relaxed text-paper-dim">{selected.description}</p>

          <a
            href={ORGANISER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block rounded-md border border-amber/40 px-4 py-2 text-center font-display text-sm uppercase tracking-wide text-amber hover:border-amber"
          >
            Check tickets with organiser ↗
          </a>
        </div>

        <details
          className="mt-4 rounded-lg border border-paper/10 bg-asphalt/80 px-4 py-3"
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.2em] text-paper-dim">
            MyKad offers, children &amp; booking details
          </summary>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-paper-dim">
            <li>
              Prices shown are 3-day MyKad (Malaysian citizen) rates. International-fan pricing is
              higher and is set by the organiser — check current rates before booking.
            </li>
            <li>Children aged 3–6 get a 25% discount; under 3 go free.</li>
            <li>G Hillstand is MyKad-only and not sold to international fans.</li>
            <li>
              Availability and pricing change as the event approaches — this page is a starting
              point, not a live inventory. Confirm both on the organiser&apos;s site before paying.
            </li>
          </ul>
        </details>
      </div>

      <div className="rounded-lg border border-paper/10 bg-asphalt/80 p-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Schematic map
        </span>
        <SepangCircuitMap stands={standMarkers} className="mt-2 w-full" />
        <p className="mt-2 text-[11px] leading-relaxed text-paper-dim/70">
          Original schematic — this app&apos;s own real apex-point centreline, not a copy of the
          organiser&apos;s venue-map graphic. Stand positions and the corners each one overlooks are
          verified against{" "}
          <a
            href={ORGANISER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-paper-dim"
          >
            sepangcircuit.com
          </a>
          &apos;s own per-stand pages, not guessed — still an approximate reference for the selected
          stand, not an allocated seat.
        </p>
      </div>
    </div>
  );
}
