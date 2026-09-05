import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-chrome";
import { PredictClient } from "@/app/predict/PredictClient";

type SearchParams = Record<string, string | string[] | undefined>;

const OG_KEYS = ["session", "cc", "ac", "rain", "temp", "cond", "ct", "at", "sc", "ty"] as const;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const session = first(sp.session) ?? "Race";
  const cc = first(sp.cc);
  const ac = first(sp.ac);

  const query = new URLSearchParams();
  for (const key of OG_KEYS) {
    const value = first(sp[key]);
    if (value !== null) query.set(key, value);
  }

  // Absolute base from the incoming request so the og:image resolves on any host.
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost:3000";
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ogUrl = `${proto}://${host}/og?${query.toString()}`;

  const shared = cc !== null && ac !== null;
  const title = shared
    ? `${session} strategy read — Jalur APEXGP`
    : "Jalur APEXGP — Sepang strategy simulator";
  const description = shared
    ? `Conservative ${cc}% vs aggressive ${ac}% for the Sepang ${session}. Run your own what-if scenario.`
    : "Pick a Sepang session and simulate conservative vs aggressive strategy from a live weather + tyre-life model.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default function PredictPage() {
  return (
    <>
      <SiteHeader />
      <PredictClient />
    </>
  );
}
