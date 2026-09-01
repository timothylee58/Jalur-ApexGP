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

## Out of scope (v2+)

Live telemetry, user accounts, historical archive / quiz, social card export,
and live tourism.gov.my booking APIs.

## Local dev

1. `cd frontend && npm install && npm run dev`
2. `cd backend && python -m venv venv && venv\Scripts\activate` (Windows) then
   `pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
3. Copy `frontend/.env.example` → `frontend/.env.local` and `backend/.env.example` → `backend/.env`

## Tests

`cd backend && pytest`

## Deploy

- Frontend: Vercel, root directory `frontend/`, env `NEXT_PUBLIC_API_URL`
- Backend: Railway, root directory `backend/`, env `FRONTEND_ORIGIN` (your Vercel URL)
- Daily MLflow log: `.github/workflows/daily-prediction-log.yml` (06:00 UTC)

## About this event

Independent, unofficial project. Not affiliated with Formula 1, the FIA,
Bahrain International Circuit, or Sepang International Circuit.
