import type { Metadata } from "next";
import { AboutNote } from "@/components/shared/AboutNote";
import { HotLapExplorer } from "@/components/circuit/HotLapExplorer";
import { SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Sepang, corner by corner — Jalur APEXGP",
  description:
    "A simulated hot lap of Sepang International Circuit: braking zones, apex speeds and the three timing sectors that decide a Grand Prix.",
};

export default function CircuitPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <HotLapExplorer />
        <AboutNote />
      </main>
    </>
  );
}
