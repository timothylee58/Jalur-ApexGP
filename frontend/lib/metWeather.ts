/**
 * MET Malaysia Sepang district forecast via data.gov.my.
 * Location Ds064 = Sepang. Malay summary phrases mapped to short English.
 */

export const MET_FORECAST_URL =
  "https://api.data.gov.my/weather/forecast/?contains=Ds064%40location__location_id&limit=14";

export const MET_WARNING_URL =
  "https://api.data.gov.my/weather/warning/?limit=100";

const PHRASES: Record<string, string> = {
  "Tiada hujan": "No rain",
  "Tiada Hujan": "No rain",
  Hujan: "Rain",
  "Hujan di beberapa tempat": "Scattered rain",
  "Hujan di satu dua tempat": "Isolated rain",
  "Ribut petir": "Thunderstorms",
  "Ribut petir di beberapa tempat": "Scattered thunderstorms",
  "Ribut petir di satu dua tempat": "Isolated thunderstorms",
  Berjerebu: "Hazy",
  Jerebu: "Haze",
};

export function describeForecast(value: string | null | undefined): string {
  if (!value) return "Not supplied";
  return PHRASES[value] ?? value;
}

export interface MetDay {
  date: string;
  minTemp: number;
  maxTemp: number;
  summary: string;
  morning: string;
  afternoon: string;
  night: string;
}

interface RawForecastRow {
  location?: { location_id?: string; location_name?: string };
  date?: string;
  morning_forecast?: string;
  afternoon_forecast?: string;
  night_forecast?: string;
  summary_forecast?: string;
  min_temp?: number;
  max_temp?: number;
}

function todayMY(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function normalizeMetForecast(raw: unknown): MetDay[] {
  if (!Array.isArray(raw)) throw new Error("Unexpected MET response");
  const today = todayMY();
  return (raw as RawForecastRow[])
    .filter(
      (row) =>
        row.location?.location_id === "Ds064" &&
        typeof row.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
        row.date >= today,
    )
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((row) => ({
      date: row.date!,
      minTemp: Number(row.min_temp ?? 0),
      maxTemp: Number(row.max_temp ?? 0),
      summary: describeForecast(row.summary_forecast),
      morning: describeForecast(row.morning_forecast),
      afternoon: describeForecast(row.afternoon_forecast),
      night: describeForecast(row.night_forecast),
    }));
}

export function formatMetDate(date: string): string {
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
