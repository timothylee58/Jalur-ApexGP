# Accuracy Board · Vue 3 demo

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/timothylee58/Jalur-ApexGP/tree/main/demos/vue-accuracy-board?file=src%2FAccuracyBoard.vue&title=Jalur%20APEXGP%20Accuracy%20Board)

A Vue 3 + TypeScript port of the `/accuracy` page from the main Next.js app,
reading the same production API: each session's prediction, locked before
it started, against what actually happened at Sepang (the circuit's own
weather station via OpenF1, and the winner's first pit stop from Jolpica),
scored per strategy variant.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # vue-tsc type-check + production build
```

| URL | Data |
| --- | --- |
| `/` | Live production API, polled on the server's cadence |
| `/?offline` | The saved 2026 Malaysian GP weekend in `public/weekend.json` |

If the live API can't be reached before anything has loaded, the board shows
the saved snapshot, labels it, and keeps retrying live.

**Where live data works:** the backend's CORS policy allows the production
frontend and `http://localhost:3000`, which is why `npm run dev` uses port
3000 (stop the Next.js dev server first if it's running). StackBlitz previews
run on their own origin, which the API doesn't allow, so there the board
shows the labelled snapshot.

## What's in it

```
src/
├─ types.ts             # the API contract (mirrors backend/app/schemas/outcome.py)
├─ useWeekendBoard.ts   # polling composable: server-driven interval, pauses on
│                       # hidden tabs, aborts superseded requests, snapshot fallback
├─ AccuracyBoard.vue    # the board: summary tiles, session rows, live/snapshot chip
└─ App.vue              # picks live or ?offline
```

- **Composition API** with `<script setup lang="ts">`, typed props, and a
  reusable composable rather than logic in the component.
- **Accessible:** a labelled section, `<ol>` of sessions, `<time datetime>`,
  state as text (not colour alone), `aria-live` status, `role="alert"` errors.
- **Times are always on Sepang's clock** (`Asia/Kuala_Lumpur`), whatever the
  viewer's timezone.
