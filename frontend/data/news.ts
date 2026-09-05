/**
 * Curated links to real F1 news — titles, sources, and outbound links only,
 * never reproduced article text or images. docs/BRAND.md rules out treating
 * any of this app's own content as official coverage; linking out to real
 * outlets (rather than hosting rewritten copies of their reporting) is how
 * the news section stays on the right side of that line while still being
 * useful — a "here's what's being reported" digest, not a newsroom.
 *
 * `summary` is this app's own one-line framing of why the linked piece is
 * relevant, not a quote or paraphrase of the source's text.
 *
 * `publishedAt` values are approximate — the search results used to find
 * these links didn't carry exact timestamps for most of them, only
 * relative context (race weekend dates, "mid-season", "so far"). They're
 * good enough to sort by and render as a relative time, not to the minute.
 */

export type NewsCategory =
  | "Race"
  | "Analysis"
  | "Driver Market"
  | "Technical"
  | "Lifestyle & Culture";

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  category: NewsCategory;
  publishedAt: string;
  summary: string;
}

export const news: NewsItem[] = [
  {
    id: "dutch-gp-report",
    title:
      "Norris wins dramatic Dutch Grand Prix from Antonelli and Russell as Verstappen crashes out",
    source: "Formula1.com",
    url: "https://www.formula1.com/en/latest/article/norris-wins-dramatic-dutch-grand-prix-from-antonelli-and-russell-as-verstappen-crashes-out.Zn7iYevVGp5eHzFkTEAz7",
    category: "Race",
    publishedAt: "2026-08-23",
    summary:
      "Zandvoort's farewell F1 race — a Mercedes podium lockout behind Norris's back-to-back win, and Verstappen's day over on Lap 1.",
  },
  {
    id: "monza-need-to-know",
    title:
      "Need to know: the most important facts, stats and trivia ahead of the 2026 Italian Grand Prix",
    source: "Formula1.com",
    url: "https://www.formula1.com/en/latest/article/need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-italian-grand-prix.3R2slU8oSHdeOc5lidJDGy",
    category: "Race",
    publishedAt: "2026-09-03",
    summary: "Round 13 at Monza — the numbers and storylines to watch this weekend.",
  },
  {
    id: "dutch-gp-winners-losers",
    title: "Winners and losers from F1's 2026 Dutch GP",
    source: "The Race",
    url: "https://www.the-race.com/formula-1/winners-and-losers-from-f1-2026-dutch-gp/",
    category: "Analysis",
    publishedAt: "2026-08-24",
    summary: "Post-race verdicts on who left Zandvoort's last Grand Prix having gained the most — and who didn't.",
  },
  {
    id: "driver-market-2027-racingnews365",
    title: "F1 driver market: the moves brewing beneath the surface",
    source: "RacingNews365",
    url: "https://racingnews365.com/f1-driver-market-the-moves-brewing-beneath-the-surface",
    category: "Driver Market",
    publishedAt: "2026-08-30",
    summary: "Most 2026 seats are locked in through 2030 — where any actual movement for 2027 is likely to happen.",
  },
  {
    id: "driver-market-2027-f1com",
    title: "The latest on the F1 driver market: what we're hearing ahead of 2027",
    source: "Formula1.com",
    url: "https://www.formula1.com/en/latest/article/what-were-hearing-about-the-current-state-of-play-in-the-f1-driver-market.5WCC2OxeAEYE4IxzOnmjPY",
    category: "Driver Market",
    publishedAt: "2026-08-28",
    summary: "Contract renewals at McLaren, Red Bull and Ferrari have calmed the market — for now.",
  },
  {
    id: "tech-analysis-2026-regs",
    title:
      "F1 tech analysis: the fascinating tech approaches to the 2026 regulations revealed by Ferrari and Alpine's new machines",
    source: "Formula1.com",
    url: "https://www.formula1.com/en/latest/article/the-fascinating-tech-secrets-of-the-2026-regulations-revealed-by-ferrari-and.3cMuqQXJ7RTqHvGkyV1H8t",
    category: "Technical",
    publishedAt: "2026-03-10",
    summary: "How suspension layout and diffuser-feed bodywork diverged across the new-regulation grid.",
  },
  {
    id: "tech-innovations-so-far",
    title: "The standout tech innovations of F1 2026 so far",
    source: "Autosport",
    url: "https://www.autosport.com/f1/news/standout-tech-innovations-f1-2026-so-far/10845183/",
    category: "Technical",
    publishedAt: "2026-08-15",
    summary: "A mid-season roundup of which regulation-reset ideas actually worked.",
  },
  {
    id: "summer-break-lifestyle",
    title: "How F1 drivers spent the 2026 summer break",
    source: "Motorsport.com",
    url: "https://www.motorsport.com/f1/news/how-f1-drivers-spent-the-2026-summer-beak/10847288/",
    category: "Lifestyle & Culture",
    publishedAt: "2026-08-20",
    summary: "Sardinia holidays, a Russell engagement, and how the grid actually spent its three weeks off.",
  },
];
