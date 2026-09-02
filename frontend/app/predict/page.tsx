"use client";

import { useState } from "react";
import { AboutNote } from "@/components/shared/AboutNote";
import { GuidePanel } from "@/components/guide/GuidePanel";
import { PredictionCard } from "@/components/predict/PredictionCard";
import { usePrediction } from "@/hooks/usePrediction";
import { SESSIONS, type Session } from "@/types";

export default function PredictPage() {
  const [session, setSession] = useState<Session>("FP1");
  const { data, loading, error } = usePrediction(session);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-lg uppercase tracking-wide text-paper">
          Jalur APEXGP
        </h1>
        <select
          value={session}
          onChange={(event) => setSession(event.target.value as Session)}
          className="cursor-pointer appearance-none rounded-full bg-amber px-3 py-1.5 font-mono text-xs text-asphalt"
        >
          {SESSIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
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
<<<<<<< HEAD
          <ConfidenceDeltaHeadline data={data} />
          <MonsoonStrip weather={data.weather} />
          <p className="font-mono text-xs text-paper-dim">
            {data.weather.condition} · {data.weather.tempC.toFixed(1)}°C · rain{" "}
            {Math.round(data.weather.rainProbability)}%
          </p>
          <PredictionCard prediction={data.conservative} session={data.session} />
          <PredictionCard prediction={data.aggressive} session={data.session} />
          <ShareReadButton data={data} />
          <GuidePanel session={session} rainProbability={data.weather.rainProbability} />
=======
          <PredictionCard prediction={data.conservative} />
          <PredictionCard prediction={data.aggressive} />
          <GuidePanel session={session} />
>>>>>>> d3a68f2 (refactor: simplify predict page to mobile desk layout)
        </div>
      ) : null}

      <AboutNote />
    </main>
  );
}
