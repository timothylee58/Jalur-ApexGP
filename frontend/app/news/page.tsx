"use client";

import { useMemo, useState } from "react";
import { AboutNote } from "@/components/shared/AboutNote";
import { LiveSessionTicker } from "@/components/news/LiveSessionTicker";
import { NewsCard } from "@/components/news/NewsCard";
import { SiteHeader } from "@/components/site-chrome";
import { news, type NewsCategory } from "@/data/news";

const CATEGORIES: NewsCategory[] = [
  "Race",
  "Analysis",
  "Driver Market",
  "Technical",
  "Lifestyle & Culture",
];

export default function NewsPage() {
  const [category, setCategory] = useState<NewsCategory | "All">("All");

  const filtered = useMemo(
    () => (category === "All" ? news : news.filter((item) => item.category === category)),
    [category],
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Latest F1 news
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Curated links, not our own coverage
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          This app doesn&apos;t run a newsroom — every headline below links
          out to the outlet that actually reported it. No article text or
          photos are reproduced here, just the title, source, and why it&apos;s
          worth a read.
        </p>

        <div className="mt-4">
          <LiveSessionTicker />
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="News category">
          {(["All", ...CATEGORIES] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={category === key}
              onClick={() => setCategory(key)}
              className={`rounded-full px-3.5 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                category === key
                  ? "bg-amber text-asphalt"
                  : "border border-paper/15 text-paper-dim hover:text-paper"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {filtered.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>

        <AboutNote />
      </main>
    </>
  );
}
