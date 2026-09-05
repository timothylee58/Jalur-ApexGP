# Jalur APEXGP — Brand Guidelines

Written against what's actually in `frontend/tailwind.config.ts` and
`frontend/app/layout.tsx` today, so this stays a description of the
implementation rather than an aspirational spec that drifts from the code.

## Positioning

Jalur APEXGP is a race engineer's read on the Sepang weekend, not a fan
magazine and not an official product. Every design decision should
reinforce "plainspoken technical tool," not "hype site." If a choice makes
the app feel more like a broadcast graphics package, it's the wrong choice
— that territory belongs to the officially licensed products, and blending
into it is the opposite of what "no official misuse" is asking for.

## Wordmark

There's no logo asset — the wordmark is the typography itself:
**JALUR APEXGP**, set in Bebas Neue, uppercase, tracked wide
(`tracking-wide` / `tracking-[0.35em]` for the smaller eyebrow use). Never
add a logomark, icon badge, or checkered-flag motif — those read as
borrowed motorsport iconography rather than an original mark, and the
wordmark-only treatment is what keeps this visually distinct from any
official F1 property.

## Color

| Token | Hex | Use |
|---|---|---|
| `asphalt` | `#14181c` | Primary background |
| `asphalt.line` | `#2a3036` | Borders, dividers |
| `pit.carbon` | `#0a0c0e` | Deepest background (hero fallback only) |
| `paper` | `#f4efe6` | Primary text |
| `paper.dim` | `#a39b8f` | Secondary text, meta labels |
| `amber` | `#f5a623` | Primary accent — CTAs, conservative-strategy accent, active states |
| `teal` | `#2ec4b6` | Aggressive-strategy accent only — paired with `amber` so the two strategy cards read apart at a glance without reading the label |
| `brick` | `#c23b22` | Warnings, key-risk callouts, errors only — never decorative |
| `pit.lime` | `#c8ff00` | Micro-label accent only (e.g. the landing page circuit eyebrow, the guide drive-time badge). Sparing, one use per screen — it's a highlight, not a second primary color |

`teal` is defined as a sibling to `amber` (both `pit.teal` and a top-level
`teal` in `tailwind.config.ts`) rather than reusing `pit.lime`, which stays
a single-use micro-accent. It's wired into `PredictionCard.tsx` and
`PitWindowTimeline.tsx` as the aggressive-variant border/label/pit-window
accent, mirrored by `amber` for conservative — see the
`VARIANT_STYLE` map in `PredictionCard.tsx` for the canonical pairing.

**Rule:** every color in this palette should be legible as a signal —
amber and teal each mark a strategy variant, brick marks risk. Don't
introduce a fourth "just decorative" color; that fits a tool that's
explicit about being a heuristic, not a black box.

## Typography

- **Display** — Bebas Neue, uppercase, wide tracking. Headlines, session
  labels, card titles. Never for body copy — it's a condensed display face
  and gets hard to read past a headline length.
- **Body** — Geist Sans. All prose: reasoning text, descriptions, ticket
  policy copy.
- **Data** — Geist Mono. Anything numeric or state-like: confidence %,
  pit windows, drive times, countdown timers, session pills. If a number
  or a status word is on screen, it should be in mono — that's the visual
  cue that it's live/derived data rather than written copy.

## Voice & tone

- Write like an engineer relaying a read over the radio, not a marketer
  selling the race: short, declarative, specific ("Box before Turn 9
  closes up" not "Get ready for an exciting pit stop!").
- State uncertainty plainly. "Confidence: 58%" and a `keyRisk` line are
  doing real work — don't undercut them with confident-sounding copy
  elsewhere on the same card.
- Disclaimers (independence, no official affiliation, no ticket sales)
  should read matter-of-fact, not defensive or apologetic. State it once,
  clearly, in the same tone as everything else — not as a nervous legal
  footnote in a different voice.
- Never use "official," "presented by," or any phrasing that could imply
  partnership with Formula 1, the FIA, or either circuit.

## Imagery

- Attraction photos: Unsplash only, fetched at build time
  (`scripts/fetch-attraction-images.ts`), never hotlinked or scraped from
  tourism sites.
- Circuit hero: the landing page background is a static SVG map by
  default, with an opt-in procedural 3D flyover (`CircuitFlyoverHero`) —
  neither is footage, so this rule doesn't constrain them. Any
  frame-sequence hero (`/apple-design` still is one) must use originally
  captured/extracted frames only (`scripts/extract-frames.py`) — never
  official F1 broadcast footage, team media, or licensed circuit
  photography.
- No driver photos, no team liveries, no sponsor logos, anywhere.
- Any AI-generated or synthetic motorsport imagery (e.g. a text-to-image
  prompt standing in for footage that can't be used) must exclude, as a
  checklist: logos, sponsor names, team liveries, Ferrari, Santander, FIA,
  F1 watermark, readable signage, real venue text (don't name Sepang or any
  real circuit in generated text or signage), and real driver likeness (no
  recognizable real driver's face). This is the same "no team liveries, no
  sponsor logos" rule above, just spelled out as an explicit negative-prompt
  checklist — a generator won't infer it from the short version alone.
- No per-team color coding, even with brand-neutral-looking hex values — a
  fixed team→color mapping reads as a livery reference once you know which
  team is which (Ferrari-and-red, Mercedes-and-teal are the obvious traps).
  `/teams` uses one neutral card style for all 11 teams for this reason.

## External content

- `/news` links out to real outlets rather than hosting rewritten
  coverage — title, source, and this app's own one-line framing only,
  never reproduced article text or photos. See `data/news.ts`.
- Data drawn from real, current-season results (driver/team "last time
  out" recaps) is WebSearch-verified against actual reporting, not
  invented — same standard the driver career stats already hold
  themselves to. Where a specific detail wasn't confirmed by any source
  found, say so plainly (e.g. "finished outside the points" as an
  inference, not a fabricated exact position) rather than making one up.
- `/telemetry` and `/circuit`'s "real lap pacing" mode use
  [OpenF1](https://openf1.org) — an independent, community-run API, not
  an official F1/FIA/FOM product, and free/keyless only for historical
  data. Both surface a real, clearly-labeled session (the 2026 Dutch GP
  at Zandvoort — the same one already cited for the driver/team recaps
  above) rather than pretending this app's own fictional Sepang weekend
  has real telemetry. No live data: OpenF1's live stream needs a paid
  account this app doesn't use, and honesty about that gap beats faking
  one, same standard the weather blend and strategy engine already hold
  themselves to (see root README's "Note on AI").
- The Sepang weekend schedule and the 2025 championship standings strip
  on `/drivers` are sourced from
  [Jolpica](https://github.com/jolpica/jolpica-f1) (Ergast-compatible,
  open-source, keyless) — again not an official F1/FIA/FOM product.
  Session starts come from Jolpica; end times aren't in the feed, so
  practice/Quali are treated as 60 minutes and the race as 120, and that
  convention is stated next to the data. Career totals on each driver
  card remain a static through-2025 snapshot; the standings strip is the
  live season-close table those numbers sit next to.

## Iconography

`lucide-react`, used sparingly (chevrons for expand/collapse, nothing
decorative). No custom icon set — introducing one is more visual surface
area to keep "originally made," not less.

## Component patterns

- Cards: `asphalt` background, `asphalt.line` border (`border-paper/10` in
  practice), generous internal padding. No drop shadows — the flat/matte
  look matches the asphalt metaphor better than elevation shadows would.
- Buttons/pills: full-radius (`rounded-full`), `amber` fill for primary
  actions, mono uppercase label text.
- Data callouts (confidence, pit window, key risk): always paired with a
  mono-set uppercase micro-label above or beside the value — never a bare
  number with no label.

## Accessibility

- `paper` on `asphalt` and `amber` on `asphalt` both clear WCAG AA for
  body text at current weights — keep it that way if either token value
  changes.
- `paper.dim` on `asphalt` is borderline for small text; reserve it for
  meta/secondary lines, not primary reading content.
- **Open gap:** interactive elements (session picker, itinerary toggle
  buttons) don't yet have explicit focus states or ARIA labels beyond one
  `aria-live` region in `GuidePanel.tsx`. Not yet a guideline violation
  since nothing contradicts it, just missing — track it in the root
  `README.md` "Known gaps" list when it's picked up.

## Don'ts

- Don't use F1's red as a primary or accent color, even unintentionally —
  check any new accent against it before shipping.
- Don't add a logomark, badge, or checkered/flag motif.
- Don't reproduce official grandstand pricing, team colors, or driver
  imagery.
- Don't rewrite or excerpt real outlets' news articles as this app's own
  content — link out instead (see External content above).
- Don't let marketing-voice copy creep into strategy card text — if it
  wouldn't sound right said over a radio, rewrite it.
