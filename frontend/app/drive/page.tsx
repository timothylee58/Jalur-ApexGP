import Link from "next/link";
import { AboutNote } from "@/components/shared/AboutNote";
import { DriveTheLap } from "@/components/drive/DriveTheLap";
import { SiteHeader } from "@/components/site-chrome";

export const metadata = {
  title: "Drive the lap — Jalur APEXGP",
  description:
    "Time attack at Sepang International Circuit in a 2026-spec F1 car: throttle, brake and Boost, the five-light start, a ghost to chase, and broadcast cameras.",
};

export default function DrivePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Mini game
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper sm:text-4xl">
          Drive the lap
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper-dim">
          A 2026-spec car on the real Sepang centreline, hills and all. The car steers itself —
          your lap is made on the pedals: brake at the boards, carry speed to each corner&apos;s
          apex figure, and spend the battery you harvest under braking on Boost. Go more than 10%
          over a corner&apos;s speed and you&apos;re off: a spin and a three-second penalty. Wait for
          the five red lights to go out, then chase the ghost — the simulated lap from{" "}
          <Link href="/circuit" className="underline decoration-paper/30 underline-offset-2 hover:text-paper">
            /circuit
          </Link>
          , until you&apos;ve set a clean lap of your own.
        </p>

        <div className="mt-6">
          <DriveTheLap />
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-paper-dim/70">
          Corner speeds are the same sourced apex figures /circuit&apos;s simulator uses, and the car
          uses its public 2026 ballpark numbers (768 kg, ~750 kW, 5 g braking) — a game, not a
          simulator of any real car. Your best lap and its ghost are stored on this device only.
        </p>

        <AboutNote />
      </main>
    </>
  );
}
