/**
 * Fetches one Unsplash photo per attraction (by its imageQuery) and writes the
 * resulting imageUrl back into frontend/data/attractions.ts.
 *
 * Usage:
 *   UNSPLASH_ACCESS_KEY=xxx npx tsx scripts/fetch-attraction-images.ts
 *
 * Idempotent: an attraction that already has imageUrl set is skipped, so a
 * partial/failed run can be re-run safely without re-spending rate limit.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) {
  console.error("UNSPLASH_ACCESS_KEY is required.");
  process.exit(1);
}

const DATA_FILE = join(__dirname, "..", "frontend", "data", "attractions.ts");

interface UnsplashSearchResult {
  results: Array<{
    urls: { regular: string; small: string };
    user: { name: string; links: { html: string } };
  }>;
}

async function searchPhoto(query: string): Promise<string | null> {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  });

  if (!res.ok) {
    console.warn(`  ! Unsplash request failed (${res.status}) for "${query}"`);
    return null;
  }

  const body = (await res.json()) as UnsplashSearchResult;
  const first = body.results[0];
  if (!first) {
    console.warn(`  ! No results for "${query}"`);
    return null;
  }

  // "regular" (~1080px wide) is enough for a 7rem-tall card band without
  // pulling full-resolution originals.
  return first.urls.regular;
}

async function main() {
  const source = readFileSync(DATA_FILE, "utf-8");
  const lines = source.split("\n");

  let currentId: string | null = null;
  let pendingUrl: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const idMatch = lines[i].match(/^\s*id:\s*"([^"]+)",\s*$/);
    if (idMatch) {
      currentId = idMatch[1];
      pendingUrl = null;
      continue;
    }

    // Already has an imageUrl for the entry currently being scanned — leave
    // it alone (idempotent re-run) and stop tracking it.
    if (currentId && /^\s*imageUrl:\s*"[^"]*",\s*$/.test(lines[i])) {
      console.log(`- ${currentId}: already has imageUrl, skipping`);
      currentId = null;
      continue;
    }

    const queryMatch = currentId && lines[i].match(/^(\s*)imageQuery:\s*"([^"]+)",\s*$/);
    if (queryMatch) {
      const [, indent, query] = queryMatch;
      console.log(`- ${currentId}: searching "${query}"...`);
      // eslint-disable-next-line no-await-in-loop -- sequential, rate-limit friendly
      const imageUrl = await searchPhoto(query);
      if (imageUrl) {
        pendingUrl = `${indent}imageUrl: "${imageUrl}",`;
        console.log(`  ✓ ${imageUrl}`);
      }
      // Unsplash's demo tier is capped at 50 req/hr — a small delay keeps
      // this comfortably clear of that even on a larger attraction list.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }

    // End of this attraction's object — insert the fetched imageUrl line
    // right before the closing brace if we found one and none existed.
    if (currentId && pendingUrl && /^\s*\},\s*$/.test(lines[i])) {
      lines.splice(i, 0, pendingUrl);
      i++;
      currentId = null;
      pendingUrl = null;
    }
  }

  writeFileSync(DATA_FILE, lines.join("\n"));
  console.log(`\nWrote ${DATA_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
