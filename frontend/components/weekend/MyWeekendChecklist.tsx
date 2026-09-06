"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "jalur:my-weekend-checklist";

const DEFAULT_ITEMS = [
  { id: "calendar", label: "Add sessions to calendar (.ics)" },
  { id: "gates", label: "Confirm gate / entry notes with organiser" },
  { id: "weather", label: "Check MET Sepang forecast morning-of" },
  { id: "transit", label: "Plan KLIA / shuttle / parking timing" },
  { id: "strategy", label: "Run FP/Quali/Race strategy reads on /predict" },
  { id: "seats", label: "Orient seats on /tickets (no prices)" },
] as const;

type ItemId = (typeof DEFAULT_ITEMS)[number]["id"];

type CheckedMap = Partial<Record<ItemId, boolean>>;

function readChecked(): CheckedMap {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as CheckedMap;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function MyWeekendChecklist() {
  const [checked, setChecked] = useState<CheckedMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChecked(readChecked());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      /* private mode */
    }
  }, [checked, ready]);

  const done = DEFAULT_ITEMS.filter((item) => checked[item.id]).length;

  return (
    <section className="min-w-0 w-full overflow-hidden border border-asphalt-line bg-pit-carbon/60 px-4 py-5 sm:px-5">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper-dim">
            My weekend
          </p>
          <h2 className="mt-1 font-display text-2xl uppercase tracking-wide text-paper">
            Local checklist
          </h2>
        </div>
        <p className="font-mono text-xs tabular-nums text-paper-dim">
          {done}/{DEFAULT_ITEMS.length}
        </p>
      </div>
      <p className="mt-2 max-w-xl text-sm text-paper-dim">
        Stays in this browser only — no account. Souvenir planning, not admission.
      </p>
      <ul className="mt-4 space-y-2">
        {DEFAULT_ITEMS.map((item) => {
          const on = Boolean(checked[item.id]);
          return (
            <li key={item.id}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 border border-asphalt-line px-3 py-2.5 hover:border-paper/20">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-amber"
                  checked={on}
                  onChange={() =>
                    setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                  }
                />
                <span
                  className={`text-sm leading-snug ${
                    on ? "text-paper-dim line-through" : "text-paper"
                  }`}
                >
                  {item.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {done > 0 ? (
        <button
          type="button"
          className="mt-4 font-mono text-[11px] uppercase tracking-wide text-paper-dim hover:text-paper"
          onClick={() => setChecked({})}
        >
          Clear checklist
        </button>
      ) : null}
    </section>
  );
}
