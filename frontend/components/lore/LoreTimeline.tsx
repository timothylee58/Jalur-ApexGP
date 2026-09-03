"use client";

import { motion, useReducedMotion } from "framer-motion";
import { loreEntries, type LoreKind } from "@/data/lore";

const KIND_ACCENT: Record<LoreKind, { dot: string; year: string; rail: string }> = {
  opening: { dot: "bg-paper", year: "text-paper", rail: "border-paper/20" },
  monsoon: { dot: "bg-brick", year: "text-brick", rail: "border-brick/30" },
  farewell: { dot: "bg-paper-dim", year: "text-paper-dim", rail: "border-paper/10" },
  return: { dot: "bg-amber", year: "text-amber", rail: "border-amber/40" },
};

export function LoreTimeline() {
  const reduceMotion = useReducedMotion();

  return (
    <ol className="relative ml-2 border-l border-paper/10 pl-6">
      {loreEntries.map((entry, index) => {
        const accent = KIND_ACCENT[entry.kind];

        return (
          <motion.li
            key={entry.id}
            className="relative pb-10 last:pb-0"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: Math.min(index * 0.06, 0.2), ease: "easeOut" }}
          >
            <span
              aria-hidden
              className={`absolute -left-[1.9rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-asphalt ${accent.dot}`}
            />
            <p className={`font-display text-3xl uppercase leading-none tracking-wide ${accent.year}`}>
              {entry.year}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
              {entry.date}
            </p>
            <h2 className="mt-3 font-display text-xl uppercase tracking-wide text-paper">
              {entry.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-paper-dim">{entry.body}</p>
            <p
              className={`mt-3 rounded-md border bg-asphalt px-3 py-2 text-xs leading-relaxed text-paper-dim ${accent.rail}`}
            >
              <span className="font-mono uppercase tracking-wide text-paper">
                Why it matters ·{" "}
              </span>
              {entry.engineerNote}
            </p>
          </motion.li>
        );
      })}
    </ol>
  );
}
