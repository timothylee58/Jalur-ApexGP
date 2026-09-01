from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    mlflow_tracking_uri: str = "file:./ml/mlruns"
    sepang_lat: float = 2.7608
    sepang_lon: float = 101.7381
    frontend_origin: str = "http://localhost:3000"
    port: int = 8000
    live_weather_weight: float = 0.65


settings = Settings()
