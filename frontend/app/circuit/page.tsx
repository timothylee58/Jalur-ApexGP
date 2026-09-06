"use client";

import { useState } from "react";
import Link from "next/link";
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
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Circuit explorer
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Sepang, corner by corner
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Drag to orbit, or tap a corner below. The amber markers sit on the
          circuit&apos;s real apex-point centreline — the same geometry
          behind the landing page&apos;s flyover hero and the 2D strategy
          map — covering all 15 named corners, with Turns 5–7, 9, and 15
          carrying the strategy engine&apos;s own reasoning. The terrain is
          a separate real photogrammetry scan (the same one as{" "}
          <Link href="/#orbit-sepang" className="text-amber hover:underline">
            Orbit Sepang
          </Link>{" "}
          on the landing page), registered against that centreline by an
          actual computed similarity transform — the two are still
          independent real-world sources with no shared coordinate system,
          so treat it as the same track correctly oriented, not a
          survey-grade fusion of the two — see{" "}
          <code className="text-amber">frontend/public/models/README.md</code>{" "}
          for the terrain&apos;s CC BY 4.0 attribution.
        </p>

        <div className="mt-6">
          <CircuitExplorer3D selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
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
