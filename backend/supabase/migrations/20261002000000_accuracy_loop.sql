-- Prediction-accuracy loop (backend/app/services/accuracy_service.py).
-- One locked pre-session prediction and one recorded outcome per
-- (season, round, session). Written only by the backend with the
-- service_role key; RLS on with no policies, so the anon key reads nothing.

create table if not exists public.accuracy_predictions (
  season int not null,
  round int not null,
  session text not null check (session in ('FP1', 'FP2', 'FP3', 'Quali', 'Race')),
  made_at timestamptz not null,
  source text not null,
  rain_probability real not null,
  temp_c real not null,
  condition text not null,
  confidence_conservative real not null,
  confidence_aggressive real not null,
  pit_start_conservative int not null,
  pit_end_conservative int not null,
  pit_start_aggressive int not null,
  pit_end_aggressive int not null,
  primary key (season, round, session)
);

create table if not exists public.accuracy_outcomes (
  season int not null,
  round int not null,
  session text not null check (session in ('FP1', 'FP2', 'FP3', 'Quali', 'Race')),
  rain_occurred boolean not null,
  actual_pit_lap int,
  rain_source text not null,
  pit_source text,
  detail jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null,
  primary key (season, round, session)
);

alter table public.accuracy_predictions enable row level security;
alter table public.accuracy_outcomes enable row level security;
