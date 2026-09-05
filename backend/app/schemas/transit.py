from pydantic import BaseModel


class TransitStop(BaseModel):
    stop_id: str
    name: str
    lat: float
    lon: float


class LiveVehicleEta(BaseModel):
    route_id: str
    route_name: str
    vehicle_id: str
    nearest_stop: TransitStop
    distance_km: float
    eta_minutes: float
    # "live_speed": the vehicle's own reported GTFS-RT speed drove the
    # estimate. "fallback_speed": it was stationary or unreported, so a
    # documented average urban-bus pace was used instead — see
    # transit_service.py's ETA_FALLBACK_SPEED_KMH.
    eta_method: str
    vehicle_timestamp: str


class HistoricalShuttleNote(BaseModel):
    label: str
    detail: str


class SepangAccessPayload(BaseModel):
    generated_at: str
    # States plainly what this data can and can't show — never omitted,
    # since the two honesty gaps this module documents (no official 2026
    # shuttle yet, no standing route reaches the circuit gate itself)
    # are exactly the kind of thing this app's own standard says to
    # surface rather than paper over (see README's "Note on AI").
    coverage_note: str
    matched_stops: list[TransitStop]
    live_vehicles: list[LiveVehicleEta]
    historical_shuttle: list[HistoricalShuttleNote]
    source: str
