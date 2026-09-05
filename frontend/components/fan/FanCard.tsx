"use client";

import Link from "next/link";
import type { Team } from "@/data/teams";
import { drivers } from "@/data/drivers";
import { photoForDriver } from "@/lib/driverPhotos";
import { carForTeam, logoForTeam } from "@/lib/teamAssets";

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
  const logo = logoForTeam(team.id);
  const car = carForTeam(team.id);

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] ${
        selected
          ? "border-paper/40 shadow-[0_0_0_1px_rgba(244,239,230,0.25)]"
          : "border-paper/10 hover:border-paper/25"
      }`}
      style={{
        background: `linear-gradient(155deg, ${team.primary}22 0%, #14181c 38%, #0a0c0e 100%)`,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-2"
        style={{ backgroundColor: team.primary, color: ink }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.28em]">
          Fan card · 2026
        </p>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="h-6 w-auto max-w-[5.5rem] object-contain object-right"
            draggable={false}
          />
        ) : (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: team.secondary }}
            aria-hidden
          />
        )}
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

            {car ? (
              <div className="relative mt-3 overflow-hidden rounded-lg border border-paper/10 bg-black/35">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={car}
                  alt=""
                  className="mx-auto h-24 w-full object-contain object-center sm:h-28"
                  draggable={false}
                />
                <p className="absolute bottom-1 left-2 font-mono text-[9px] uppercase tracking-wide text-paper-dim">
                  {team.powerUnit} PU
                </p>
              </div>
            ) : (
              <div
                className="mt-3 h-1.5 w-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${team.primary}, ${team.secondary})`,
                }}
                aria-hidden
              />
            )}

            <ul className="mt-3 grid grid-cols-2 gap-2">
              {roster.map((driver, index) =>
                driver ? (
                  <li
                    key={driver.id}
                    className="flex items-center gap-2 rounded-md border border-paper/10 bg-asphalt/50 px-2 py-2"
                  >
                    <span
                      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full"
                      style={{ boxShadow: `0 0 0 2px ${team.primary}` }}
                    >
                      {photoForDriver(driver.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoForDriver(driver.id)!}
                          alt=""
                          className="h-full w-full object-cover object-top"
                          draggable={false}
                        />
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center font-mono text-[10px] font-bold"
                          style={{ backgroundColor: team.primary, color: ink }}
                        >
                          {driver.initials}
                        </span>
                      )}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 font-mono text-[9px] font-bold"
                        style={{ backgroundColor: team.primary, color: ink }}
                      >
                        {driver.number !== null ? driver.number : "—"}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-paper">
                        {driver.name.split(" ").slice(-1)[0]}
                      </span>
                      <span className="block truncate font-mono text-[9px] uppercase tracking-wide text-paper-dim">
                        {driver.name.split(" ").slice(0, -1).join(" ") || "—"}
                      </span>
                    </span>
                  </li>
                ) : (
                  <li
                    key={index}
                    className="rounded-md border border-paper/10 px-2 py-3 text-xs text-paper-dim"
                  >
                    Unlisted
                  </li>
                ),
              )}
            </ul>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
              Last time out
            </p>
            <p className="mt-2 text-sm leading-relaxed text-paper">{team.recap}</p>
            {car ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-paper/10 bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={car}
                  alt=""
                  className="mx-auto h-20 w-full object-contain opacity-90"
                  draggable={false}
                />
              </div>
            ) : null}
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

        <div className="mt-auto flex gap-2 pt-4">
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
