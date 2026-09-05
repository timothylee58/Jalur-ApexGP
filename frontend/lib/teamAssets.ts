/**
 * Local team logo + car render paths under `public/`. Used by `/fan`
 * (constructor accent cards) and `/teams` (neutral engineer sheet, badge
 * only — no car render there, see TeamCard.tsx).
 */

export const TEAM_LOGO: Record<string, string> = {
  mclaren: "/teams/mclaren.png",
  ferrari: "/teams/ferrari.png",
  "red-bull": "/teams/red-bull.png",
  mercedes: "/teams/mercedes.png",
  "aston-martin": "/teams/aston-martin.png",
  alpine: "/teams/alpine.png",
  haas: "/teams/haas.png",
  "racing-bulls": "/teams/racing-bulls.png",
  williams: "/teams/williams.png",
  audi: "/teams/audi.png",
  cadillac: "/teams/cadillac.png",
};

export const TEAM_CAR: Record<string, string> = {
  mclaren: "/cars/mclaren.png",
  ferrari: "/cars/ferrari.png",
  "red-bull": "/cars/red-bull.png",
  mercedes: "/cars/mercedes.png",
  "aston-martin": "/cars/aston-martin.png",
  alpine: "/cars/alpine.png",
  haas: "/cars/haas.png",
  "racing-bulls": "/cars/racing-bulls.png",
  williams: "/cars/williams.png",
  audi: "/cars/audi.png",
  cadillac: "/cars/cadillac.png",
};

export function logoForTeam(teamId: string): string | null {
  return TEAM_LOGO[teamId] ?? null;
}

export function carForTeam(teamId: string): string | null {
  return TEAM_CAR[teamId] ?? null;
}
