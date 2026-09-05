import { SEPANG_2026_SESSIONS } from "@/lib/sepangSchedule";

/** Build a weekend .ics (MYT sessions, UTC DTSTART/DTEND) for calendar apps. */

function stampUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildWeekendIcs(): string {
  const now = stampUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jalur APEXGP//Sepang Weekend//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Jalur APEXGP — Sepang 2026",
    "X-WR-TIMEZONE:Asia/Kuala_Lumpur",
  ];

  for (const session of SEPANG_2026_SESSIONS) {
    const start = new Date(session.start);
    const end = new Date(session.end);
    const uid = `jalur-apexgp-${session.session}-2026@sepang`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stampUtc(start)}`,
      `DTEND:${stampUtc(end)}`,
      `SUMMARY:${icsEscape(`${session.session} — Bahrain GP @ Sepang`)}`,
      "LOCATION:Sepang International Circuit",
      `DESCRIPTION:${icsEscape(
        "Unofficial fan calendar from Jalur APEXGP. Confirm times against the organiser.",
      )}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(`${session.session} starts in 30 minutes`)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadWeekendIcs(filename = "jalur-apexgp-sepang-2026.ics"): void {
  const blob = new Blob([buildWeekendIcs()], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
