"use client";

import { useEffect, useState } from "react";
import { FanCard } from "@/components/fan/FanCard";
import { teams } from "@/data/teams";

const STORAGE_KEY = "jalur-apexgp-fan-team";

export function FanDeck() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && teams.some((team) => team.id === saved)) {
        setSelectedId(saved);
      }
    } catch {
      // private mode / blocked storage — pick still works in-session
    }
    setReady(true);
  }, []);

  function pickTeam(id: string) {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  const selected = teams.find((team) => team.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div
        className="rounded-lg border border-paper/10 bg-asphalt/80 px-4 py-3"
        aria-live="polite"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper-dim">
          My garage
        </p>
        <p className="mt-1 font-display text-2xl uppercase tracking-wide text-paper">
          {!ready
            ? "…"
            : selected
              ? selected.name
              : "No team picked yet"}
        </p>
        <p className="mt-1 text-xs text-paper-dim">
          Choice stays in this browser only — flip a card for the Zandvoort
          recap, or open the neutral team sheet.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <FanCard
            key={team.id}
            team={team}
            selected={selectedId === team.id}
            flipped={flippedId === team.id}
            onSelect={() => pickTeam(team.id)}
            onFlip={() =>
              setFlippedId((current) => (current === team.id ? null : team.id))
            }
          />
        ))}
      </div>
    </div>
  );
}
