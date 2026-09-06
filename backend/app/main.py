from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.jolpica import router as jolpica_router
from app.api.routes.outcomes import router as outcomes_router
from app.api.routes.predict import router as predict_router
from app.api.routes.telemetry import router as telemetry_router
from app.api.routes.transit import router as transit_router
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

# /api prefix matches Vercel's zero-config FastAPI routing convention
# (confirmed active on this project — its framework is auto-detected as
# "fastapi") rather than fighting it with a custom vercel.json rewrite.
# That rewrite existed here before and actively broke every route in
# production: Vercel's build log states plainly that "internal rewrites in
# backend framework projects now route requests using the rewritten
# destination path" — meaning the app received every request as literally
# "/api/index", matching neither /predict nor /health, 404ing universally.
# Confirmed live against the deployed backend before this fix. Local dev
# also uses this prefix (baked into the app itself, not deploy-specific) —
# see frontend/.env.example for the matching NEXT_PUBLIC_API_URL value.
app.include_router(predict_router, prefix="/api")
app.include_router(telemetry_router, prefix="/api")
app.include_router(jolpica_router, prefix="/api")
app.include_router(transit_router, prefix="/api")
app.include_router(outcomes_router, prefix="/api")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
