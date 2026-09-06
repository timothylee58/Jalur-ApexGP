import { AboutNote } from "@/components/shared/AboutNote";
import { DriveTheLap } from "@/components/drive/DriveTheLap";
import { SiteHeader } from "@/components/site-chrome";

export const metadata = {
  title: "Drive the lap — Jalur APEXGP",
  description:
    "Throttle-and-brake lap-time attack around the real Sepang apex-point centreline — no steering, just corner speed.",
};

export default function DrivePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Mini game
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper sm:text-4xl">
          Drive the lap
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper-dim">
          No steering — the car runs the real apex-point centreline itself. Your job is speed:
          hold throttle down the straights, lift and brake before each corner. Push past a
          corner&apos;s safe speed (the trackside boards ahead go green → amber → red) and it
          counts as off-track — a time penalty and a spin, same shape as a real track-limits
          call.
        </p>

        <div className="mt-6">
          <DriveTheLap />
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-paper-dim/70">
          Corner-safe speeds are derived from this centreline&apos;s own curvature, not a real
          tyre model — a guide for &quot;did you lift here,&quot; not telemetry. Best lap is
          stored on this device only.
        </p>

        <AboutNote />
      </main>
    </>
  );
}
