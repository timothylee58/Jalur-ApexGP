import pytest

from app.schemas.prediction import WeatherSnapshot


@pytest.fixture
def dry_weather() -> WeatherSnapshot:
    return WeatherSnapshot(
        temp_c=33.0,
        rain_probability=12.0,
        condition="Mostly dry",
    )


@pytest.fixture
def wet_weather() -> WeatherSnapshot:
    return WeatherSnapshot(
        temp_c=28.0,
        rain_probability=78.0,
        condition="Thunderstorm risk",
    )
