# Jalur APEXGP

A race-engineer **strategy simulator** for the Sepang F1 race weekend.
Pick a session (FP1 / FP2 / FP3 / Quali / Race) and get two strategy reads —
conservative vs aggressive — with confidence scores, a lap-by-lap stint plan,
and a pit window derived from modelled tyre life, built on a live weather blend
(Open-Meteo). Then run your own **what-if** scenarios (rain, track temp, safety
car, forced starting compound) and the model recomputes live.

## Architecture

Next.js (Vercel) → FastAPI (Vercel) → Open-Meteo + deterministic strategy
blend → MLflow run logging. No database, no auth — stateless, public, read-only.

**Honest framing (no "AI"):** this is a deterministic, rules-based *simulator*,
not a trained predictor. It blends live Open-Meteo weather with Sepang
climatology, then runs a transparent tyre/compound heuristic and a lap-by-lap
stint model to derive pit windows. The response is labelled
`modelKind: "deterministic-simulator"` so the UI never oversells it. MLflow logs
only the unmodified live read (what-if scenarios are exploratory and are not
logged), and the API echoes the effective `inputs` a read ran on.

## Features

- **Landing page lap preview** ("The lap") — a second full-bleed,
  scroll-scrubbed hero, same mechanism as the circuit flyover above it,
  stacked directly beneath it on the landing page. Source clip is a
  generic, unbranded single-seater (no team livery, no sponsor decals) —
  genuinely clean, so unlike the flyover and `/apple-design` it skips
  `scripts/extract-frames.py --stylize` entirely; a background trackside
  sign board in some shots was checked at native resolution and confirmed
  not legible, not stylized to destroy it — see
  `frontend/public/lap-preview-frames/README.md`. Replaced an earlier
  compact-GIF-card version of this section, and an earlier still that used
  real official F1 broadcast footage of the 2016 Malaysian Grand Prix — a
  bird's-eye clip with a burned-in F1 logo watermark and a live telemetry
  graphic, which docs/BRAND.md explicitly rules out and no amount of
  mosaic-ing fixes (the whole clip is FOM's copyrighted broadcast, not an
  incidental decal).
- **Static circuit map hero** (landing page background) — the landing hero now
  renders the static SVG Sepang map (projected from the project's own apex data
  in `data/sepangCircuit.ts`), replacing the retired scroll-scrubbed flyover,
  which depended on 48 WebP frames that were never committed. The **Product
  reveal** (`/apple-design`) still uses the scroll-scrubbed frame-sequence
  mechanism (`ScrollFrameSequence`), populated with a time-windowed
  sharp/mosaic treatment for a source clip with a sponsor mark partway through.
  Two real
  bugs surfaced and fixed at the shared `ScrollFrameSequence` component
  itself (so every section built on it benefits): it never set a loaded
  texture's `colorSpace`, shifting colors once real frames replaced the
  solid fallback; and it mapped scroll progress to the whole document's
  scroll height, so stacking a second full-bleed section on one page (or
  adding content below a single one) started or ended its frame scrub off
  from where the section itself was actually pinned. Fixed by measuring
  progress against each section's own sticky-plus-spacer wrapper instead
  (`rangeRef`), verified by scrolling both the landing page (two stacked
  sequences) and `/apple-design` (one, plus content below it) end-to-end.
- **Strategy simulator** (`/predict`) — session picker, dual strategy cards
  with distinct conservative/aggressive accents, confidence bars, a lap-by-lap
  stint plan, a pit-window band derived from modelled tyre life, reasoning +
  key risk, a confidence-delta headline backed by the MLflow same-day trend
  lookup, and a monsoon hourly-rain strip. Additions in this pass:
  - **What-if controls** — rain %, track temp, safety-car toggle, and a forced
    starting compound. Every knob flows through the same backend rules and
    re-runs the read live (a deliberately bad choice — e.g. slicks in a
    downpour — reads as clearly less confident).
  - **Lap/stint model** — the pit window is no longer a fixed fraction of the
    session; the first stint runs to its compound's modelled life (shortened by
    track heat, pulled earlier by a safety car). Softer opening tyres therefore
    pit earlier than durable ones.
  - **Beginner glossary** — the strategy copy auto-annotates jargon (undercut,
    deg, DRS, pit window, offset…); tap any dotted term for a plain-English,
    Sepang-flavoured explainer.
  - **Static circuit map** — an SVG of the Sepang layout (projected from the
    project's own apex data) highlights exactly the corners the current
    reasoning names (backend returns `referencedCorners`).
  - **Shareable strategy card** — the share link encodes the full scenario and
    the page renders a per-scenario `og:image` (via the `/og` route), so a
    shared read previews as a real card; a "Card" button opens the image
    directly.
- **Trip planning** — a single outbound link to
  [Tourism Malaysia](https://www.malaysia.travel/) on `/predict`, replacing the
  old in-app tourism/itinerary panel (a different user's job than race strategy).
- **Deep links** — `/predict?session=FP2` preselects that session; with no
  param the page falls back to `getLiveOrNextSession()` against the 2026
  weekend schedule (Jolpica/Ergast round 16 at Sepang — the Bahrain Grand
  Prix hosted in Malaysia, 2–4 Oct) rather than a hardcoded FP1.
- **Circuit lore** (`/lore`) — scroll-revealed timeline of four Sepang
  moments (1999 opening, 2009 monsoon red flag, 2017 farewell, 2026
  return), each tied to why it shapes a strategy read.
- **Tickets** (`/tickets`) — reduced to a single outbound link to the official
  [Sepang International Circuit](https://www.sepangcircuit.com/home) site;
  pricing/seating change yearly and belong at the source, not duplicated here.
- **Driver grid** (`/drivers`) — an interactive 3D layout of the 2026 grid
  (22 drivers, 11 teams, career stats through the 2025 season close) and a
  second "Sepang history" set tied to three moments in `/lore`. Initials-only
  markers, no photos or team liveries — see `docs/BRAND.md`. Each 2026-grid
  driver also carries a "last time out" recap of the 2026 Dutch Grand
  Prix at Zandvoort — the most recently completed real round — WebSearch-
  verified rather than invented; deep-linkable via `/drivers?driver=<id>`.
  A compact 2025 championship standings strip (top five drivers and
  constructors) is fetched live from Jolpica/Ergast rather than hand-copied.
- **Teams** (`/teams`) — all 11 constructors (base, 2026 power unit,
  constructors' titles, roster, and the same Zandvoort recap from the
  team's side), one neutral card style for every team rather than color-
  coding by team — a fixed team→color mapping reads as a livery reference
  once you know which team is which, exactly what `docs/BRAND.md` rules
  out.
- **News** (`/news`) — curated links to real F1 reporting, filterable by
  category. Titles, sources, and this app's own one-line framing only —
  never reproduced article text, per `docs/BRAND.md`. A live-session
  ticker at the top shows synthetic, schedule-derived markers ("Lights
  out", "Chequered flag imminent") only while `now` genuinely falls inside
  the fixed Sepang weekend window; otherwise it says so plainly rather
  than faking a live feed this app has no telemetry source for. Also links
  out to the official F1 [Apple TV channel](https://tv.apple.com/us/channel/formula-1/tvs.sbd.241000),
  the [Bahrain Grand Prix](https://tv.apple.com/us/grand-prix/bahrain-grand-prix/umc.csl.1o0z2mi3mbs4pxxkvx7ldh3ju?ctx_brand=tvs.sbd.241000)
  event hub (the round Sepang is hosting in 2026), and
  [F1 The Movie](https://tv.apple.com/us/movie/f1-the-movie/umc.cmc.3t6dvnnr87zwd4wmvpdx5came)
  under Lifestyle & Culture. A small "Watch this weekend →" link on the
  landing hero and `/predict` points at that Bahrain GP hub.
- **3D models** — `/models/sepang.glb` (the landing page's "Orbit Sepang"
  stage) and `/models/car.glb` (an animated lap on `/circuit`'s traced
  curve) are procedurally generated by `scripts/generate_circuit_models.py`.
  `sepang.glb` is now a spline-swept ribbon **projected from the circuit's
  real 18-point apex + elevation data** (the same centreline as
  `scripts/blender/sepang_circuit_scene.py` and `data/sepangCircuit.ts`), so
  the layout shape and its ~22 m elevation change are real (vertical
  exaggerated ~6× for readability); `car.glb` stays box/cylinder primitives,
  no scanned geometry. The car is deliberately unbranded (no livery, no sponsor
  marks, no race number). Surfaced a real gotcha worth knowing if you ever
  touch that script: trimesh's GLB exporter silently omits the `NORMAL`
  accessor by default, even with vertex normals explicitly set on the
  mesh — invisible (unlit black) once loaded, since three.js's
  `GLTFLoader` doesn't compute missing normals itself. Fixed with
  `include_normals=True` on `.export()`; see
  `frontend/public/models/README.md`. An alternative, much higher-fidelity
  Blender-based generator lives at `scripts/blender/` — untested end to
  end (no Blender in this dev environment), documented there as an
  optional path rather than the current source of truth for the shipped
  file.
- **Real telemetry** (`/telemetry`, and `/circuit`'s "real lap pacing"
  toggle) — speed, throttle, brake, RPM, gear, and DRS from
  [OpenF1](https://openf1.org) (free, keyless, historical-only; see
  `docs/BRAND.md`), replaying the same real 2026 Dutch GP at Zandvoort
  already cited for the driver/team recaps. `/circuit` doesn't plot the
  real car's actual coordinates — this app's track shape is a stylized
  fictional trace, and the real corners don't line up with it — instead
  it paces movement along the *existing* traced curve by the real lap's
  distance-weighted speed profile (`lib/telemetry.ts`'s
  `buildDistanceProgress`), so a real braking zone visibly slows the
  fictional car at whatever point in its own lap that fraction of
  distance falls, even though the corner positions are unrelated. Backend
  proxies OpenF1 (`backend/app/services/telemetry_service.py`) rather
  than calling it from the browser, matching the existing Open-Meteo
  pattern; the date-range filter needed a hand-built query string, since
  OpenF1's `date>`/`date<` syntax glues the operator directly onto the
  field name rather than using `key=value`.

  **Verification gap, stated plainly:** `api.openf1.org` is blocked by
  this dev sandbox's own network egress policy, so this integration was
  built and unit-tested against a mocked HTTP transport
  (`backend/tests/test_telemetry_service.py`) — confirming this repo's
  own request-building and response-parsing logic, not that OpenF1's real
  API actually matches the field names/shapes assumed here. The most
  likely failure mode if something's off: the target session not
  existing yet in OpenF1's archive, which the backend turns into a clean
  404/502 rather than a crash (confirmed against the real, blocked host
  from this sandbox — it fails exactly that way). Test this against the
  live API somewhere with ordinary internet access (a normal dev machine
  or the deployed Vercel function both qualify) before relying on it.

## Brand

Design tokens, voice/tone rules, and component patterns are documented in
[`docs/BRAND.md`](./docs/BRAND.md) — written against what's actually in
`frontend/tailwind.config.ts`, kept in sync rather than aspirational.

## Known gaps (next session priorities)

- `eslint.config.mjs` imports `eslint-config-next/core-web-vitals` without
  the `.js` extension, so `next build` skips linting with a resolution
  error.
- The `og:image` scenario card is rendered from a shared link's query params,
  not from a fresh backend read — a shared card reflects the numbers captured
  at share time (which is the intent, but worth knowing).

## Out of scope (v2+)

User accounts, a results-based accuracy/scoring loop against real session
outcomes, and a full 15-corner interactive circuit map.

## Local dev

1. `cd frontend && npm install && npm run dev`
2. `cd backend && python -m venv venv && venv\Scripts\activate` (Windows) then
   `pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
3. Copy `frontend/.env.example` → `frontend/.env.local` and `backend/.env.example` → `backend/.env`

## Tests

`cd backend && pip install -r requirements-dev.txt && pytest`

## Deploy

Both frontend and backend deploy as separate Vercel projects from this one
repo — no other platform involved.

**Frontend** (Next.js)
- New Vercel project, root directory `frontend/`, framework preset
  Next.js (auto-detected).
- Env: `NEXT_PUBLIC_API_URL` = the backend project's deployed URL **with an
  `/api` suffix** (e.g. `https://jalur-apexgp-backend.vercel.app/api`) — see
  below for why.

**Backend** (FastAPI, as a Vercel Python serverless function)
- A second Vercel project, root directory `backend/`, framework preset
  `fastapi` (auto-detected — confirmed via the Vercel API on this project).
  `backend/api/index.py` exposes the existing FastAPI `app` as the ASGI
  entrypoint Vercel's Python runtime wraps; `pyproject.toml`'s
  `[tool.vercel] entrypoint` pins it explicitly so Vercel's auto-detection
  doesn't also pick `app/main.py` as a second candidate entrypoint (it
  otherwise would — that scan independently checks `app/` and `src/`
  subdirectories for recognized filenames, and this repo's `app/main.py`
  matches by coincidence of Python package naming, not because it's meant
  to be its own function).
- Routes are mounted under `/api` (`/api/predict`, `/api/health`) — this
  matches Vercel's own zero-config FastAPI convention, which routes
  `/api/*` straight to the function with no rewrite needed. An earlier
  version of this project used a catch-all `vercel.json` rewrite instead;
  that broke every route in production. Vercel's own build log explained
  why in plain text: *"Internal rewrites in backend framework projects now
  route requests using the rewritten destination path"* — meaning the app
  received every request as literally `/api/index`, matching none of its
  real routes, 404ing universally. Confirmed live against the deployed
  backend (every path, including `/`, returned an identical FastAPI-shaped
  404) before switching to the prefix approach and removing `vercel.json`
  entirely.
- `requirements.txt` uses `mlflow-skinny` rather than full `mlflow` — the
  full package pulls pandas/pyarrow/sklearn and comfortably risks Vercel's
  function size limit; skinny is client-only (no local UI/server) and is
  all `mlflow_client.py` actually uses. Verified combined runtime deps
  (fastapi + uvicorn + mlflow-skinny + the rest) come to ~130MB
  uncompressed, well under the 250MB Hobby-tier limit.
- **MLflow needs a durable tracking backend** — a Vercel function's
  filesystem doesn't persist between invocations, so the local-dev default
  (`file:./ml/mlruns`) silently breaks `get_confidence_trend` in
  production (same-day trend needs multiple runs to actually persist
  across requests). `mlflow-skinny` only supports `file`, `http(s)`, and
  `databricks`/`databricks-uc` tracking URI schemes — notably *not* a bare
  SQL/Postgres URI, which needs the full `mlflow` package. The practical
  free option is
  [Databricks Community Edition](https://community.cloud.databricks.com)'s
  hosted MLflow tracking (a REST backend, not a second thing you host):
  set `MLFLOW_TRACKING_URI=databricks`, `DATABRICKS_HOST`,
  `DATABRICKS_TOKEN`, and `MLFLOW_EXPERIMENT_NAME` to an absolute
  workspace path (Databricks requires this — see
  `backend/.env.example`).
- Env: `FRONTEND_ORIGIN` (the frontend project's deployed URL, for CORS),
  plus the MLflow vars above.
- A wedged or misconfigured tracking backend can't stall `/predict` itself —
  `mlflow_client.py` bounds every MLflow call to 4s in a daemon thread.
  Verified this against a genuinely unreachable host: without it,
  `mlflow.set_experiment()` blocks indefinitely inside Databricks SDK's own
  auth resolution, before any HTTP call — `MLFLOW_HTTP_REQUEST_TIMEOUT`
  doesn't reach that stall, so a code-level bound was the only reliable
  fix. Worth knowing if you ever touch that file: don't swap the daemon
  thread for `ThreadPoolExecutor` without checking — its workers are
  non-daemon, so `shutdown(wait=False)` stops the *call* from blocking but
  a genuinely stuck one still keeps the whole process alive afterward.

**Daily MLflow log** — `.github/workflows/daily-prediction-log.yml`
(06:00 UTC) needs the same `MLFLOW_TRACKING_URI` /
`MLFLOW_EXPERIMENT_NAME` / `DATABRICKS_HOST` / `DATABRICKS_TOKEN` as repo
secrets (Settings → Secrets and variables → Actions), pointed at the same
Databricks workspace as the deployed backend — otherwise this cron logs
into its own throwaway CI-runner filesystem and contributes nothing to
same-day trend history, which is what it was doing before this was wired
up properly.

## About this event

Independent, unofficial project. Not affiliated with Formula 1, the FIA,
Bahrain International Circuit, or Sepang International Circuit.
