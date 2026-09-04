# Jalur APEXGP

AI-style race engineer simulator for the Sepang F1 race weekend.
Pick a session (FP1 / FP2 / FP3 / Quali / Race) and get two strategy reads —
conservative vs aggressive — with confidence scores and a suggested pit window,
built on a live weather blend (Open-Meteo) and tracked with MLflow.

A secondary panel maps the gap after that session to originally written
Sepang / Selangor / KL attraction notes, grouped by drive time from the circuit.

## Architecture

Next.js (Vercel) → FastAPI (Railway) → Open-Meteo + deterministic strategy
blend → MLflow run logging. No database, no auth — stateless, public, read-only.

**Note on "AI":** the strategy engine is a climatology / live-data blend, not a
trained ML model. MLflow is used for experiment lifecycle tracking.

## Features

- **Landing page lap preview** — a stylized, desaturated mosaic loop of a
  car in motion at the circuit, sitting between the hero and the 3D track
  model. Sourced from a user-supplied clip that showed real sponsor decals
  and team livery colors; treated (grayscale, coarse-mosaic downsample) to
  destroy every decal's legibility and strip the livery's color identity
  before it went anywhere near the page — see `docs/BRAND.md`.
- **Predict flow** (`/predict`) — session picker, dual strategy cards with
  distinct conservative/aggressive accents, confidence bars, pit-window lap
  band, reasoning + key risk, a confidence-delta headline backed by the
  MLflow same-day trend lookup, a monsoon hourly-rain strip, and a
  URL-only share button.
- **Deep links** — `/predict?session=FP2` preselects that session; with no
  param the page falls back to `getLiveOrNextSession()` against the 2026
  weekend schedule rather than a hardcoded FP1.
- **Circuit lore** (`/lore`) — scroll-revealed timeline of four Sepang
  moments (1999 opening, 2009 monsoon red flag, 2017 farewell, 2026
  return), each tied to why it shapes a strategy read.
- **Session-gap guide** — attractions filtered by the real gap after each
  session, reordered toward indoor picks when rain risk is high, with a
  drive-time itinerary builder and per-stop "leave by" countdown.
- **Ticket orientation** (`/tickets`) — grandstand names and seating
  categories, no pricing, no sales.
- **Driver grid** (`/drivers`) — an interactive 3D layout of the 2026 grid
  (22 drivers, 11 teams, career stats through the 2025 season close) and a
  second "Sepang history" set tied to three moments in `/lore`. Initials-only
  markers, no photos or team liveries — see `docs/BRAND.md`.

## Brand

Design tokens, voice/tone rules, and component patterns are documented in
[`docs/BRAND.md`](./docs/BRAND.md) — written against what's actually in
`frontend/tailwind.config.ts`, kept in sync rather than aspirational.

## Known gaps (next session priorities)

- `AttractionCard` renders an image band, but no entry in
  `data/attractions.ts` sets `imageUrl` — every guide card currently shows
  an empty placeholder. `scripts/fetch-attraction-images.ts` exists and is
  idempotent, but hasn't been run yet — needs `UNSPLASH_ACCESS_KEY` and
  outbound access to `api.unsplash.com`.
- Circuit hero frames are not extracted yet, so `CircuitFrameSequence`
  renders its solid-color fallback instead of real footage. See
  `scripts/extract-frames.py` — needs a locally downloaded source video.
- `eslint.config.mjs` imports `eslint-config-next/core-web-vitals` without
  the `.js` extension, so `next build` skips linting with a resolution
  error.

## Out of scope (v2+)

Live telemetry, user accounts, historical archive / quiz, social card export,
and live tourism.gov.my booking APIs.

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
