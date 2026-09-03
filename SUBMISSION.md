# Jalur APEXGP — submission writeup

## The problem

Sepang's F1 weekend is back in 2026, running under the Formula 1 Gulf Air
Bahrain Grand Prix name rather than a rebranded Malaysian Grand Prix. A fan
going to the circuit for a session has two separate, unrelated questions
before they even get to the racing: *what tyre strategy actually makes sense
given how this specific track behaves in this specific weather*, and *what
do I do with the hours between sessions*. Jalur APEXGP answers both from one
weather read, because they come from the same input — the rain call that
picks a tyre sequence is the same rain call that decides whether the
gap-time guide points you indoors.

## What makes this Sepang-specific, not generic-F1

- **The tyre logic is tuned to this circuit's actual failure modes, not a
  generic strategy template.** `strategy_service.py`'s reasoning strings
  name Sepang's own corners and hazards — Turn 9's closing radius, the
  Turn 5–7 esses heat-soak, the Turn 15 queue on a qualifying out-lap. This
  isn't a stats model; it's rule-based, and the README says so plainly
  rather than dressing it up as "AI."
- **The weather blend exists because of Sepang's specific storm behavior.**
  The 2009 race was red-flagged after 31 laps when an afternoon monsoon cell
  arrived and never let up — the app blends an hourly rain curve rather than
  a single daily percentage for exactly that reason, and the `/lore` page
  says so explicitly next to the entry describing that race.
- **The gap-time guide is scoped to real geography around the circuit**,
  not a generic "things to do in Malaysia" list — every attraction carries
  an actual drive time from Sepang and a proximity band (near-circuit /
  Selangor / KL) that drives which picks surface first when rain risk goes
  up.

## What's honestly scoped vs. what's real

**Real, and load-bearing:**
- The weather blend (Open-Meteo + a fixed Sepang climatology fallback) is
  live and actually degrades gracefully — the fallback isn't a stub, it's
  the thing that keeps `/predict` answering if Open-Meteo is down.
- MLflow's same-day confidence trend (`get_confidence_trend`) is genuinely
  derived from the app's own logged run history, not decorative. It queries
  same-day runs for the session, and only returns a trend when the swing is
  ≥1 point — see `backend/app/core/mlflow_client.py`.
- The itinerary builder checks round-trip drive time against the actual gap
  budget between sessions and computes a live "leave by" countdown per
  stop — this is arithmetic against real session times
  (`lib/sepangSchedule.ts`), not a static suggestion.

**Honestly not real, and said so in the README rather than hidden:**
- The strategy engine is a deterministic climatology/rain-probability blend
  with hand-written reasoning strings per condition, not a trained model.
  MLflow here is for experiment lifecycle tracking of that engine, not for
  training it.
- The three.js circuit hero has real scroll-scrub infrastructure but no
  extracted frames yet — it renders a solid-color fallback until the video
  is processed locally (`scripts/extract-frames.py`, outside what a
  sandboxed session can run without local file/network access).
- Attraction card images are unpopulated — the fetch script exists and is
  idempotent (`scripts/fetch-attraction-images.ts`), but hasn't been run
  against a real Unsplash key yet.

## What changed this session

Four components existed, compiled, and were never imported by any page —
`ConfidenceDeltaHeadline`, `MonsoonStrip`, `ShareReadButton`,
`PitWindowTimeline` — plus `SiteHeader` and `getLiveOrNextSession`. All are
now wired in. `/predict?session=X` deep links work end-to-end (verified with
Playwright against a production build, not just eyeballed). Conservative and
aggressive strategy cards are visually distinct again (amber vs. teal).
Cursor Bugbot's two findings against that change (a stale-session bug on
cleared URL params, a permanent-hide bug for reduced-motion users on the new
`/lore` timeline) were fixed and verified same-session. A misuse audit
across every page found no trademark/logo exposure and no pricing anywhere,
and one real gap — the landing page's disclaimer sat two-plus screens below
the fold — which is now also surfaced directly in the hero.

Full detail: [`README.md`](./README.md)'s "Note on AI" and "Known gaps"
sections, and [PR #3](https://github.com/timothylee58/Jalur-ApexGP/pull/3).

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XHEHHdZJtpUij8spYeMgX4
