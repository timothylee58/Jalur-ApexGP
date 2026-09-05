"use client";

import { useEffect, useState } from "react";
import type { NewsItem } from "@/data/news";
import { formatRelativeTime } from "@/lib/relativeTime";

export function NewsCard({ item }: { item: NewsItem }) {
  // Relative time reads from `now`, so compute it client-side after mount —
  // rendering it during SSR would freeze "X days ago" at build time instead
  // of the visitor's actual clock, and could hydration-mismatch besides.
  const [relative, setRelative] = useState<string | null>(null);
  useEffect(() => {
    setRelative(formatRelativeTime(item.publishedAt));
  }, [item.publishedAt]);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-paper/10 bg-asphalt px-4 py-3 transition-colors hover:border-paper/25"
    >
      <span className="inline-block rounded-full bg-paper/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
        {item.category}
      </span>
      <h3 className="mt-2 text-sm font-medium leading-snug text-paper">{item.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-paper-dim">{item.summary}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
        {item.source}
        {relative ? ` · ${relative}` : null}
        <span aria-hidden className="ml-1">
          ↗
        </span>
      </p>
    </a>
  );
}
