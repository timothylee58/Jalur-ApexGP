"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AboutNote } from "@/components/shared/AboutNote";
import { GuidePanel } from "@/components/guide/GuidePanel";
import { ConfidenceDeltaHeadline } from "@/components/predict/ConfidenceDeltaHeadline";
import { MonsoonStrip } from "@/components/predict/MonsoonStrip";
import { PredictionCard } from "@/components/predict/PredictionCard";
import { ShareReadButton } from "@/components/predict/ShareReadButton";
import { usePrediction } from "@/hooks/usePrediction";
import { getLiveOrNextSession } from "@/lib/sepangSchedule";
import { isSession } from "@/lib/utils";
import { SESSIONS, type Session } from "@/types";

export default function PredictPage() {
  const [session, setSession] = useState<Session>(() => getLiveOrNextSession());
  const { data, loading, error } = usePrediction(session);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("session");
    if (isSession(raw)) setSession(raw);
  }, []);

  function handleSessionChange(value: string) {
    if (isSession(value)) setSession(value);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-lg uppercase tracking-wide text-paper">
          <Link href="/">Jalur APEXGP</Link>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/tickets"
            className="font-mono text-[11px] uppercase tracking-wide text-paper-dim"
          >
            Stands
          </Link>
          <select
            value={session}
            onChange={(event) => handleSessionChange(event.target.value)}
            className="cursor-pointer appearance-none rounded-full bg-amber px-3 py-1.5 font-mono text-xs text-asphalt"
          >
            {SESSIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center font-mono text-sm text-paper-dim">
          Reading the weather…
        </p>
      ) : null}

      {error ? (
        <p className="py-10 text-center font-mono text-sm text-brick">
          Couldn&apos;t load this session. Try again.
        </p>
      ) : null}

      {data ? (
        <div className="space-y-3">
          <ConfidenceDeltaHeadline data={data} />
          <MonsoonStrip weather={data.weather} />
          <p className="font-mono text-xs text-paper-dim">
            {data.weather.condition} · {data.weather.tempC.toFixed(1)}°C · rain{" "}
            {Math.round(data.weather.rainProbability)}%
          </p>
          <PredictionCard prediction={data.conservative} session={data.session} />
          <PredictionCard prediction={data.aggressive} session={data.session} />
          <ShareReadButton data={data} />
          <GuidePanel session={session} />
        </div>
      ) : null}

      <AboutNote />
    </main>
  );
}
