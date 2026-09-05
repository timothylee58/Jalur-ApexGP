export interface TransitStop {
  stop_id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface LiveVehicleEta {
  route_id: string;
  route_name: string;
  vehicle_id: string;
  nearest_stop: TransitStop;
  distance_km: number;
  eta_minutes: number;
  eta_method: "live_speed" | "fallback_speed";
  vehicle_timestamp: string;
}

export interface HistoricalShuttleNote {
  label: string;
  detail: string;
}

export interface SepangAccessPayload {
  generated_at: string;
  coverage_note: string;
  matched_stops: TransitStop[];
  live_vehicles: LiveVehicleEta[];
  historical_shuttle: HistoricalShuttleNote[];
  source: string;
}
