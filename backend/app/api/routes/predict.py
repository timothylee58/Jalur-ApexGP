from fastapi import APIRouter

from app.core.mlflow_client import get_confidence_trend, log_prediction
from app.schemas.prediction import PredictionRequest, PredictionResponse, SimInputs
from app.services.strategy_service import build_prediction
from app.services.weather_service import WeatherService, condition_from_rain

router = APIRouter()
weather_service = WeatherService()


@router.post("/predict", response_model=PredictionResponse)
async def predict(payload: PredictionRequest) -> PredictionResponse:
    weather = await weather_service.get_snapshot()

    rain_overridden = payload.rain_probability is not None
    temp_overridden = payload.temp_c is not None
    if rain_overridden or temp_overridden:
        eff_rain = payload.rain_probability if rain_overridden else weather.rain_probability
        eff_temp = payload.temp_c if temp_overridden else weather.temp_c
        weather = weather.model_copy(
            update={
                "rain_probability": eff_rain,
                "temp_c": eff_temp,
                "condition": condition_from_rain(eff_rain) if rain_overridden else weather.condition,
            }
        )

    prediction = build_prediction(
        payload.session,
        weather,
        safety_car=payload.safety_car,
        tyre_choice=payload.tyre_choice,
    )

    inputs = SimInputs(
        rain_probability=weather.rain_probability,
        temp_c=weather.temp_c,
        safety_car=payload.safety_car,
        tyre_choice=payload.tyre_choice,
        rain_overridden=rain_overridden,
        temp_overridden=temp_overridden,
    )

    # Only the unmodified live read is logged/trended — what-if scenarios are
    # exploratory and would otherwise pollute the MLflow experiment history.
    is_live_read = not (rain_overridden or temp_overridden or payload.safety_car or payload.tyre_choice)
    trend = None
    if is_live_read:
        log_prediction(prediction)
        trend = get_confidence_trend(payload.session, prediction)

    return prediction.model_copy(update={"confidence_trend": trend, "inputs": inputs})
