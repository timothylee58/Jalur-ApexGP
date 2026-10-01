import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    # OpenF1 (openf1.org) — free, no API key, historical data from 2023
    # onward; real-time MQTT streaming needs a paid account, which this app
    # doesn't use (see telemetry_service.py's module docstring).
    openf1_base_url: str = "https://api.openf1.org/v1"
    # TracingInsights (github.com/TracingInsights) — Apache-2.0 public F1
    # data, one repo per season, built from FastF1 and published ~30 min
    # after each session. Keyless and served from GitHub's raw CDN, so it has
    # no OpenF1-style rate limit: the telemetry fallback, and the source for
    # whole-session views (see tracinginsights_service.py).
    tracinginsights_raw_base_url: str = "https://raw.githubusercontent.com/TracingInsights"
    # Jolpica (api.jolpi.ca) — open-source Ergast-compatible F1 results API,
    # free and keyless. Used for the Sepang weekend schedule and 2025
    # championship standings; not an official F1/FIA/FOM product.
    jolpica_base_url: str = "https://api.jolpi.ca/ergast/f1"
    # Malaysia's official open-data API (developer.data.gov.my) — a real
    # government source, not an F1/circuit-operated feed. Used for live
    # RapidKL (Prasarana) bus positions toward the Sepang/KLIA corridor;
    # see transit_service.py's module docstring for what this can and
    # can't actually show.
    gtfs_static_base_url: str = "https://api.data.gov.my/gtfs-static"
    gtfs_realtime_base_url: str = "https://api.data.gov.my/gtfs-realtime/vehicle-position"
    mlflow_tracking_uri: str = "file:./ml/mlruns"
    # Databricks (and most hosted MLflow backends) require an absolute
    # workspace path, e.g. "/Users/you@example.com/jalur-apexgp-predictions" —
    # override via env for that target rather than relying on the bare-name
    # default, which only works against a local "file:" store.
    mlflow_experiment_name: str = "jalur-apexgp-predictions"
    # Read by the mlflow client directly via os.environ, not through this
    # Settings object — declared here only so a local .env file can supply
    # them too (see the sync below). Unset in production; Vercel's own env
    # vars land in os.environ natively and don't need this at all.
    databricks_host: str | None = None
    databricks_token: str | None = None
    sepang_lat: float = 2.7608
    sepang_lon: float = 101.7381
    frontend_origin: str = "http://localhost:3000"
    port: int = 8000
    live_weather_weight: float = 0.65
    # Race-day Picks storage (Supabase Postgres via its PostgREST HTTP
    # API). The service_role key, never the anon key — RLS on both picks
    # tables has no permissive policies, so only this key can read/write.
    # Unset in dev is a valid state (picks_service raises a clear
    # PicksStorageUnavailable rather than silently no-op'ing); this
    # feature has no local-file fallback the way MLflow does.
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    # Race-engineer assistant (rag_service.py). Unset is a valid state:
    # the chat route answers 503 with a clear "not configured" message
    # rather than failing, and every other feature is unaffected.
    anthropic_api_key: str | None = None
    # Override only to pin a different model; rag_service defaults to
    # claude-opus-5 when this is empty.
    chat_model: str | None = None
    # Spend guardrails for the public chat route (see chat_guard.py). Per
    # client, per serverless instance; a Vercel WAF rule is the durable layer.
    chat_rate_per_minute: int = 6
    chat_rate_per_day: int = 60
    chat_global_per_minute: int = 120
    # Comma-separated extra browser origins allowed to call /api/chat, e.g.
    # a preview deployment. FRONTEND_ORIGIN and localhost are always allowed.
    chat_extra_origins: str = ""


settings = Settings()

# pydantic-settings loads .env into this object's fields but never into
# os.environ itself — mlflow's own Databricks auth reads DATABRICKS_HOST /
# DATABRICKS_TOKEN straight from os.environ, so a value that only exists on
# `settings` is invisible to it. Sync them across (without clobbering a real
# process env var, e.g. one Vercel injected) so a local .env file actually
# works end-to-end, the same as it does in production.
if settings.databricks_host and "DATABRICKS_HOST" not in os.environ:
    os.environ["DATABRICKS_HOST"] = settings.databricks_host
if settings.databricks_token and "DATABRICKS_TOKEN" not in os.environ:
    os.environ["DATABRICKS_TOKEN"] = settings.databricks_token
