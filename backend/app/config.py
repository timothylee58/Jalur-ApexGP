import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
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
