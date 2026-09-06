"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AboutNote } from "@/components/shared/AboutNote";
import { SepangCircuitMap } from "@/components/circuit/SepangCircuitMap";
import { ConfidenceDeltaHeadline } from "@/components/predict/ConfidenceDeltaHeadline";
import { MonsoonStrip } from "@/components/predict/MonsoonStrip";
import { PredictionCard } from "@/components/predict/PredictionCard";
import { ShareReadButton } from "@/components/predict/ShareReadButton";
import { WhatIfControls } from "@/components/predict/WhatIfControls";
import { usePrediction } from "@/hooks/usePrediction";
import { parseWhatIfParams } from "@/lib/predictionUtils";
import { getLiveOrNextSession } from "@/lib/sepangSchedule";
import { SESSIONS, type Session, type WhatIf } from "@/types";

const MALAYSIA_TOURISM_URL = "https://www.malaysia.travel/";

function parseSession(value: string | null): Session | null {
  return SESSIONS.includes(value as Session) ? (value as Session) : null;
}

function PredictView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSession = parseSession(searchParams.get("session"));

  // Null until resolved: the time-based default is computed after mount so the
  // server-rendered markup and the first client render agree.
  const [session, setSession] = useState<Session | null>(paramSession);

  // Hydrate the what-if simulator from a shared link's query params, once.
  const [whatIf, setWhatIf] = useState<WhatIf>(() =>
    parseWhatIfParams(new URLSearchParams(searchParams.toString())),
  );

  useEffect(() => {
    // A missing/invalid param always resolves fresh — otherwise navigating to a
    // bare /predict after a session is already picked would silently keep the
    // stale session instead of falling back to the live/next one.
    setSession(paramSession ?? getLiveOrNextSession());
  }, [paramSession]);

  const { data, loading, error } = usePrediction(session, whatIf);

  const handleSelect = useCallback(
    (next: Session) => {
      setSession(next);
      router.replace(`/predict?session=${next}`, { scroll: false });
    },
    [router],
  );

  const resetWhatIf = useCallback(() => setWhatIf({}), []);

  const highlightedCorners = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set([
        ...(data.conservative.referencedCorners ?? []),
        ...(data.aggressive.referencedCorners ?? []),
      ]),
    );
  }, [data]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            Strategy simulator
          </p>
          <p className="font-display text-2xl uppercase tracking-wide text-paper">
            {session ?? "—"}
          </p>
        </div>
        <label className="flex flex-col items-end gap-1">
          <span className="sr-only">Choose session</span>
          <select
            value={session ?? ""}
            onChange={(event) => handleSelect(event.target.value as Session)}
            className="cursor-pointer appearance-none rounded-full bg-amber px-3 py-1.5 font-mono text-xs text-asphalt"
          >
            {SESSIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-6 font-mono text-[11px] leading-relaxed text-paper-dim/70">
        A deterministic weather + tyre-life model, not an AI prediction. Move the sliders to run
        your own scenario.
      </p>

      <WhatIfControls whatIf={whatIf} inputs={data?.inputs ?? null} onChange={setWhatIf} onReset={resetWhatIf} />

      {loading && !data ? (
        <p className="py-10 text-center font-mono text-sm text-paper-dim">
          Reading the weather…
        </p>
      ) : null}

      {error ? (
        <p className="py-10 text-center font-mono text-sm text-brick">
          Couldn&apos;t load this session. Try again.
        </p>
      ) : null}

      {data && session ? (
        <div className={`mt-3 space-y-3 ${loading ? "opacity-60 transition-opacity" : ""}`}>
          <ConfidenceDeltaHeadline data={data} />
          <MonsoonStrip weather={data.weather} />

          <section className="rounded-lg border border-paper/10 bg-asphalt px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
              Corners in this read
            </p>
            <SepangCircuitMap
              highlighted={highlightedCorners}
              className="mx-auto mt-2 w-full max-w-[280px]"
            />
            <p className="mt-1 text-center font-mono text-[10px] text-paper-dim">
              {highlightedCorners.length > 0
                ? `Highlighted: ${highlightedCorners.join(" · ")}`
                : "Sepang International Circuit"}
            </p>
          </section>

          <PredictionCard prediction={data.conservative} session={session} raceLaps={data.raceLaps} />
          <PredictionCard prediction={data.aggressive} session={session} raceLaps={data.raceLaps} />
          <ShareReadButton data={data} />

          <a
            href={MALAYSIA_TOURISM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-paper/10 bg-asphalt px-4 py-3 text-sm text-paper-dim hover:border-amber hover:text-amber"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
              Between sessions
            </span>
            <span className="mt-1 block">Planning the trip around the weekend? Tourism Malaysia →</span>
          </a>
        </div>
      ) : null}

      <AboutNote />
    </main>
  );
}

export function PredictClient() {
  return (
    <Suspense
      fallback={
        <p className="py-10 text-center font-mono text-sm text-paper-dim">
          Reading the weather…
        </p>
      }
    >
      <PredictView />
    </Suspense>
  );
}
