"use client";

import { useState } from "react";
import { AboutNote } from "@/components/shared/AboutNote";
import { CircuitExplorer3D } from "@/components/circuit/CircuitExplorer3D";
import { SiteHeader } from "@/components/site-chrome";
import { circuitCorners } from "@/data/circuitCorners";

export default function CircuitPage() {
  const [selectedId, setSelectedId] = useState<string | null>(circuitCorners[0].id);
  const selected = circuitCorners.find((corner) => corner.id === selectedId) ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Circuit explorer
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Sepang, corner by corner
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Drag to orbit, or tap a corner below. This is a stylized model
          traced from the circuit&apos;s published general map — not
          survey-grade geometry — built to showcase the same four corners
          the strategy engine's own reasoning already names.
        </p>

        <div className="mt-6">
          <CircuitExplorer3D selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {circuitCorners.map((corner) => (
            <button
              key={corner.id}
              type="button"
              onClick={() => setSelectedId(corner.id)}
              aria-pressed={selectedId === corner.id}
              className={`rounded-md border px-3 py-2 text-left font-mono text-xs uppercase tracking-wide transition-colors ${
                selectedId === corner.id
                  ? "border-amber bg-amber/10 text-amber"
                  : "border-paper/10 text-paper-dim hover:text-paper"
              }`}
            >
              {corner.code}
            </button>
          ))}
        </div>

        {selected ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-lg border border-paper/10 bg-asphalt px-4 py-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
              {selected.code} · {selected.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-paper-dim">{selected.note}</p>
          </div>
        ) : null}

        <AboutNote />
      </main>
    </>
  );
}
