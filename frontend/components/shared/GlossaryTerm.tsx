"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GlossaryEntry } from "@/data/glossary";

interface GlossaryTermProps {
  entry: GlossaryEntry;
  children: React.ReactNode;
}

/** An inline jargon term that reveals a plain-English explainer on tap/click. */
export function GlossaryTerm({ entry, children }: GlossaryTermProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((v) => !v)}
        className="cursor-help border-b border-dotted border-amber/70 text-inherit hover:text-amber focus:outline-none focus-visible:ring-1 focus-visible:ring-amber"
      >
        {children}
      </button>
      {open ? (
        <span
          id={popId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-md border border-amber/40 bg-pit-carbon p-3 text-left text-xs font-normal leading-relaxed text-paper shadow-lg"
        >
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
            {entry.label}
          </span>
          {entry.definition}
        </span>
      ) : null}
    </span>
  );
}
