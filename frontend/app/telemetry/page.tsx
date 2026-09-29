import Link from "next/link";
import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";
import { TelemetryDashboard } from "@/components/telemetry/TelemetryDashboard";

export default function TelemetryPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Real telemetry
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          A real recorded lap
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-paper-dim">
          Speed, throttle, brake, RPM, gear and track position from{" "}
          <a href="https://openf1.org" target="_blank" rel="noopener noreferrer" className="text-amber hover:underline">
            OpenF1
          </a>
          , with{" "}
          <a
            href="https://github.com/TracingInsights"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber hover:underline"
          >
            TracingInsights
          </a>
          &apos; published FastF1 data as the fallback when OpenF1&apos;s free tier is busy — both independent,
          community-run projects, not official F1/FIA products. This app&apos;s own Sepang race weekend is
          fictional (see <code className="text-paper">docs/BRAND.md</code>), so this page replays a real one
          instead: the 2026 Dutch Grand Prix at Zandvoort, the same round cited on{" "}
          <Link href="/drivers" className="text-amber hover:underline">
            /drivers
          </Link>{" "}
          and{" "}
          <Link href="/teams" className="text-amber hover:underline">
            /teams
          </Link>
          .
        </p>

        <div className="mt-6">
          <TelemetryDashboard />
        </div>

        <AboutNote />
      </main>
    </>
  );
}
