from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.predict import router as predict_router
from app.config import settings

app = FastAPI(
    title="Jalur APEXGP",
    description="Deterministic Sepang strategy blend with Open-Meteo weather and MLflow logging.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(predict_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
