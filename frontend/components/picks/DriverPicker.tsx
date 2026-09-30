"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DriverAvatar } from "@/components/drivers/DriverAvatar";
import { driverById, rosterByStanding, teamOfDriver } from "@/lib/pickRoster";
import { driverStanding } from "@/lib/standings";
import { logoForTeam } from "@/lib/teamAssets";
import type { StandingsPayload } from "@/types/jolpica";

interface DriverPickerProps {
  /** The question, for screen readers. */
  label: string;
  value: string | undefined;
  onChange: (driverId: string) => void;
  /** Drivers this question can't take, and why (another podium place). */
  unavailable?: Record<string, string>;
  standings: StandingsPayload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}

function standingText(standings: StandingsPayload | null, driverId: string): string | null {
  const row = driverStanding(standings, driverId);
  return row ? `P${row.position} · ${row.points} pts` : null;
}

/**
 * Choose one of the 22 drivers from the grid itself, faces and liveries
 * included, instead of a 22-line dropdown of names. Teams sit in
 * championship order with each driver's live position, so the choice is
 * made with the form guide in view. Collapsed, it shows the pick.
 */
export function DriverPicker({
  label,
  value,
  onChange,
  unavailable = {},
  standings,
  open,
  onOpenChange,
  disabled = false,
}: DriverPickerProps) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const selected = driverById(value);
  const selectedTeam = teamOfDriver(value);

  // Opening moves focus to the current pick (or the first choice), so a
  // keyboard user lands inside the grid rather than back at the top.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
      panel?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    target?.focus({ preventScroll: true });
  }, [open]);

  const close = () => {
    onOpenChange(false);
    triggerRef.current?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };

  const choose = (driverId: string) => {
    onChange(driverId);
    close();
  };

  return (
    <div className="mt-3">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-amber/60 bg-paper/5" : "border-paper/10 bg-asphalt hover:border-paper/30"
        }`}
        style={selectedTeam && !open ? { boxShadow: `inset 3px 0 0 ${selectedTeam.primary}` } : undefined}
      >
        {selected && selectedTeam ? (
          <>
            <DriverAvatar
              driverId={selected.id}
              initials={selected.initials}
              number={selected.number}
              accent={selectedTeam.primary}
              accentSecondary={selectedTeam.secondary}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-paper">{selected.name}</span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-paper-dim">
                {selectedTeam.name}
                {standingText(standings, selected.id) ? ` · ${standingText(standings, selected.id)}` : ""}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 py-2.5 text-sm text-paper-dim">Choose a driver</span>
        )}
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
          {open ? "Close" : selected ? "Change" : "Pick"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="group"
            aria-label={label}
            onKeyDown={onPanelKeyDown}
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-2 grid gap-1.5 sm:grid-cols-2"
          >
            {rosterByStanding(standings).map(({ team, drivers }) => {
              const logo = logoForTeam(team.id);
              return (
                <div
                  key={team.id}
                  className="rounded-md border border-paper/10 bg-pit-carbon/60 p-1.5 pl-2"
                  style={{ boxShadow: `inset 3px 0 0 ${team.primary}` }}
                >
                  <p className="flex items-center gap-1.5 px-1 pb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local static team badge
                      <img src={logo} alt="" className="h-3.5 w-3.5 object-contain" draggable={false} />
                    ) : null}
                    {team.name}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {drivers.map((driver) => {
                      const reason = unavailable[driver.id];
                      const pressed = value === driver.id;
                      const standing = standingText(standings, driver.id);
                      return (
                        <button
                          key={driver.id}
                          type="button"
                          aria-pressed={pressed}
                          disabled={Boolean(reason)}
                          onClick={() => choose(driver.id)}
                          className={`flex min-w-0 items-center gap-2 rounded border px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-40 ${
                            pressed ? "bg-paper/10" : "border-transparent hover:bg-paper/5"
                          }`}
                          style={pressed ? { borderColor: team.primary } : undefined}
                        >
                          <DriverAvatar
                            driverId={driver.id}
                            initials={driver.initials}
                            number={driver.number}
                            accent={team.primary}
                            accentSecondary={team.secondary}
                            active={pressed}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-xs text-paper">{driver.name}</span>
                            <span className="block truncate font-mono text-[10px] text-paper-dim">
                              {reason ?? standing ?? "—"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
