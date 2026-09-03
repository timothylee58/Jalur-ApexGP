"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AboutNote } from "@/components/shared/AboutNote";
import { GuidePanel } from "@/components/guide/GuidePanel";
import { ConfidenceDeltaHeadline } from "@/components/predict/ConfidenceDeltaHeadline";
import { MonsoonStrip } from "@/components/predict/MonsoonStrip";
import { PredictionCard } from "@/components/predict/PredictionCard";
import { ShareReadButton } from "@/components/predict/ShareReadButton";
import { SiteHeader } from "@/components/site-chrome";
import { usePrediction } from "@/hooks/usePrediction";
import { getLiveOrNextSession } from "@/lib/sepangSchedule";
import { SESSIONS, type Session } from "@/types";

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

  useEffect(() => {
    if (paramSession) {
      setSession(paramSession);
      return;
    }
    setSession((current) => current ?? getLiveOrNextSession());
  }, [paramSession]);

  const { data, loading, error } = usePrediction(session);

  const handleSelect = useCallback(
    (next: Session) => {
      setSession(next);
      router.replace(`/predict?session=${next}`, { scroll: false });
    },
    [router],
  );

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            Session read
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

      {data && session ? (
        <div className="space-y-3">
          <ConfidenceDeltaHeadline data={data} />
          <MonsoonStrip weather={data.weather} />
          <PredictionCard prediction={data.conservative} session={session} />
          <PredictionCard prediction={data.aggressive} session={session} />
          <ShareReadButton data={data} />
          <GuidePanel session={session} rainProbability={data.weather.rainProbability} />
        </div>
      ) : null}

      <AboutNote />
    </main>
  );
}

export default function PredictPage() {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <p className="py-10 text-center font-mono text-sm text-paper-dim">
            Reading the weather…
          </p>
        }
      >
        <PredictView />
      </Suspense>
    </>
  );
}
