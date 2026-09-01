from fastapi import APIRouter

from app.core.mlflow_client import get_confidence_trend, log_prediction
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.strategy_service import build_prediction
from app.services.weather_service import WeatherService

router = APIRouter()
weather_service = WeatherService()


@router.post("/predict", response_model=PredictionResponse)
async def predict(payload: PredictionRequest) -> PredictionResponse:
    weather = await weather_service.get_snapshot()
    prediction = build_prediction(payload.session, weather)
    log_prediction(prediction)
    trend = get_confidence_trend(payload.session, prediction)
    return prediction.model_copy(update={"confidence_trend": trend})
