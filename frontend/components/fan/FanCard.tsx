"use client";

import Link from "next/link";
import type { Team } from "@/data/teams";
import { drivers } from "@/data/drivers";

interface FanCardProps {
  team: Team;
  selected: boolean;
  flipped: boolean;
  onSelect: () => void;
  onFlip: () => void;
}

function contrastInk(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#0a0c0e";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? "#0a0c0e" : "#f4efe6";
}

export function FanCard({
  team,
  selected,
  flipped,
  onSelect,
  onFlip,
}: FanCardProps) {
  const roster = team.driverIds.map(
    (id) => drivers.find((driver) => driver.id === id) ?? null,
  );
  const ink = contrastInk(team.primary);
  // team.primary / team.secondary are the /fan accent hexes from data/teams.ts

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] ${
        selected
          ? "border-paper/40 shadow-[0_0_0_1px_rgba(244,239,230,0.25)]"
          : "border-paper/10 hover:border-paper/25"
      }`}
      style={{
        background: `linear-gradient(155deg, ${team.primary}22 0%, #14181c 42%, #0a0c0e 100%)`,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-2.5"
        style={{ backgroundColor: team.primary, color: ink }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.28em]">
          Fan card · 2026
        </p>
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: team.secondary }}
          aria-hidden
        />
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        {!flipped ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl uppercase leading-none tracking-wide text-paper">
                  {team.name}
                </h2>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
                  Est. {team.founded} · {team.base}
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
                {team.constructorTitles > 0
                  ? `${team.constructorTitles} titles`
                  : "0 titles"}
              </p>
            </div>

            <div
              className="mt-4 h-1.5 w-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${team.primary}, ${team.secondary})`,
              }}
              aria-hidden
            />

            <ul className="mt-4 space-y-2">
              {roster.map((driver, index) =>
                driver ? (
                  <li
                    key={driver.id}
                    className="flex items-baseline justify-between gap-2 border-b border-paper/10 pb-2 last:border-0"
                  >
                    <span className="text-sm text-paper">{driver.name}</span>
                    <span className="font-mono text-[11px] text-paper-dim">
                      {driver.number !== null ? `#${driver.number}` : "—"}
                    </span>
                  </li>
                ) : (
                  <li key={index} className="text-sm text-paper-dim">
                    Unlisted
                  </li>
                ),
              )}
            </ul>

            <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
              {team.powerUnit} power unit
            </p>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
              Last time out
            </p>
            <p className="mt-2 text-sm leading-relaxed text-paper">{team.recap}</p>
            <div className="mt-4 flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-wide">
              <Link href={`/teams#${team.id}`} className="text-amber hover:underline">
                Team sheet →
              </Link>
              {roster[0] ? (
                <Link
                  href={`/drivers?driver=${roster[0].id}`}
                  className="text-paper-dim hover:text-paper"
                >
                  {roster[0].name.split(" ").slice(-1)[0]} →
                </Link>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-auto flex gap-2 pt-5">
          <button
            type="button"
            onClick={onSelect}
            className={`min-h-10 flex-1 rounded-full px-3 font-mono text-[11px] uppercase tracking-wide transition-colors ${
              selected
                ? "bg-amber text-asphalt"
                : "border border-paper/20 text-paper hover:border-paper/40"
            }`}
          >
            {selected ? "Your team" : "Pick team"}
          </button>
          <button
            type="button"
            onClick={onFlip}
            className="min-h-10 rounded-full border border-paper/20 px-3 font-mono text-[11px] uppercase tracking-wide text-paper-dim hover:border-paper/40 hover:text-paper"
          >
            {flipped ? "Front" : "Flip"}
          </button>
        </div>
      </div>
    </article>
  );
}
