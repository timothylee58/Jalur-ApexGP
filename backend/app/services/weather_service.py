from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.schemas.prediction import HourlyRainPoint, WeatherSnapshot

MYT = ZoneInfo("Asia/Kuala_Lumpur")

SEPANG_CLIMATOLOGY = WeatherSnapshot(
    temp_c=32.4,
    rain_probability=42.0,
    condition="Partly cloudy",
    hourly_rain=[],
    monsoon_note="",
)


def condition_from_rain(rain_probability: float) -> str:
    if rain_probability >= 70:
        return "Thunderstorm risk"
    if rain_probability >= 45:
        return "Shower risk"
    if rain_probability >= 20:
        return "Partly cloudy"
    return "Mostly dry"


def build_monsoon_note(hourly: list[HourlyRainPoint]) -> str:
    if len(hourly) < 2:
        return ""
    current = hourly[0].rain_probability
    peak = max(hourly, key=lambda point: point.rain_probability)
    if peak.rain_probability - current >= 15:
        return f"Rain risk rising toward {peak.hour_label} ({peak.rain_probability:.0f}%)"
    if current - hourly[-1].rain_probability >= 15:
        return f"Rain risk easing after {hourly[0].hour_label}"
    if peak.rain_probability >= 55:
        return f"Storm window around {peak.hour_label} — Sepang can flip in minutes"
    return ""


def blend_weather(live: WeatherSnapshot, climatology: WeatherSnapshot, live_weight: float) -> WeatherSnapshot:
    climate_weight = 1.0 - live_weight
    rain = live.rain_probability * live_weight + climatology.rain_probability * climate_weight
    temp = live.temp_c * live_weight + climatology.temp_c * climate_weight
    hourly = live.hourly_rain
    note = build_monsoon_note(hourly) if hourly else live.monsoon_note
    return WeatherSnapshot(
        temp_c=temp,
        rain_probability=rain,
        condition=condition_from_rain(rain),
        hourly_rain=hourly,
        monsoon_note=note,
    )


def _parse_hourly_rain(payload: dict[str, Any]) -> list[HourlyRainPoint]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    probs = hourly.get("precipitation_probability") or []
    if not times or not probs:
        return []

    now = datetime.now(MYT)
    points: list[HourlyRainPoint] = []
    for time_str, prob in zip(times, probs, strict=False):
        try:
            dt = datetime.fromisoformat(time_str).replace(tzinfo=MYT)
        except ValueError:
            continue
        if dt < now:
            continue
        if len(points) >= 4:
            break
        label = dt.strftime("%I%p").lstrip("0").lower()
        points.append(HourlyRainPoint(hour_label=label, rain_probability=float(prob)))
    return points


class WeatherService:
    async def get_snapshot(self) -> WeatherSnapshot:
        live = await self._fetch_live()
        if live is None:
            return SEPANG_CLIMATOLOGY.model_copy()
        return blend_weather(live, SEPANG_CLIMATOLOGY, settings.live_weather_weight)

    async def _fetch_live(self) -> WeatherSnapshot | None:
        params = {
            "latitude": settings.sepang_lat,
            "longitude": settings.sepang_lon,
            "current": "temperature_2m,precipitation,weather_code",
            "hourly": "precipitation_probability",
            "timezone": "Asia/Kuala_Lumpur",
            "forecast_days": 1,
        }
        url = f"{settings.open_meteo_base_url}/forecast"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                payload: dict[str, Any] = response.json()
        except httpx.HTTPError:
            return None

        current = payload.get("current") or {}
        hourly_rain = _parse_hourly_rain(payload)
        rain_values = [point.rain_probability for point in hourly_rain]
        rain_probability = rain_values[0] if rain_values else SEPANG_CLIMATOLOGY.rain_probability
        precip = float(current.get("precipitation", 0.0))
        if precip >= 2:
            rain_probability = max(rain_probability, 70.0)

        snapshot = WeatherSnapshot(
            temp_c=float(current.get("temperature_2m", SEPANG_CLIMATOLOGY.temp_c)),
            rain_probability=rain_probability,
            condition=condition_from_rain(rain_probability),
            hourly_rain=hourly_rain,
            monsoon_note=build_monsoon_note(hourly_rain),
        )
        return snapshot
