"use client";

import { useState } from "react";
import { SepangCircuitMap } from "@/components/circuit/SepangCircuitMap";

const ORGANISER_URL = "https://www.sepangcircuit.com/home";

interface Stand {
  id: string;
  name: string;
  /** MYR 3-day price for Malaysian MyKad holders, or null if sold out. */
  priceMyr: number | null;
  kind: "grandstand" | "hillstand";
  /** Turn marker(s) on SepangCircuitMap to highlight, if any. */
  corners: string[];
  description: string;
}

const STANDS: Stand[] = [
  {
    id: "main",
    name: "Main Grandstand",
    priceMyr: 2083.4,
    kind: "grandstand",
    corners: ["T15"],
    description:
      "Seated, rooftop viewing. North side takes in the start/finish straight, pit entry and exit, and the team pit boxes; the south side looks over the back straight into the final corner.",
  },
  {
    id: "k1",
    name: "K1 Grandstand",
    priceMyr: null,
    kind: "grandstand",
    corners: ["T1"],
    description: "Turns 1 and 2 — the best seat for the race start and first-corner overtakes.",
  },
  {
    id: "k2",
    name: "K2 Hillstand",
    priceMyr: 809.6,
    kind: "hillstand",
    corners: ["T1"],
    description:
      "Elevated hillstand near Turns 1–2, closer to the fan-zone atmosphere than the covered stands across the circuit.",
  },
  {
    id: "f",
    name: "F Grandstand",
    priceMyr: null,
    kind: "grandstand",
    corners: ["T5–T7"],
    description:
      "Seated grandstand along the esses. Good sightlines, but the most isolated stand from the paddock atmosphere.",
  },
  {
    id: "c",
    name: "C Hillstand",
    priceMyr: 809.6,
    kind: "hillstand",
    corners: ["T9"],
    description:
      "Grass, open-air — partly covered. Panoramic view of the technical mid-sector (Turns 9–11) and the high-speed run onto the back straight.",
  },
  {
    id: "b",
    name: "B Hillstand",
    priceMyr: null,
    kind: "hillstand",
    corners: ["T15"],
    description: "Grass, open-air. Turns 12–14 toward the end of the lap.",
  },
  {
    id: "g",
    name: "G Hillstand",
    priceMyr: 200,
    kind: "hillstand",
    corners: [],
    description:
      "Grass, open-air — the budget entry point. Malaysian MyKad holders only; not sold to international fans.",
  },
];

function formatMyr(value: number): string {
  return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SeatFinder() {
  const [selectedId, setSelectedId] = useState<string>("b");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selected = STANDS.find((s) => s.id === selectedId) ?? STANDS[0];

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
        <SepangCircuitMap highlighted={selected.corners} className="mt-2 w-full" />
        <p className="mt-2 text-[11px] leading-relaxed text-paper-dim/70">
          Original schematic, not the organiser&apos;s venue map — approximate corner reference for
          the selected stand, not an allocated seat.
        </p>
      </div>
    </div>
  );
}
