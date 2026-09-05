export interface ScheduleSession {
  session: string;
  start: string;
  end: string;
}

export interface WeekendSchedule {
  season: string;
  round: string;
  raceName: string;
  circuitId: string;
  circuitName: string;
  source: string;
  sessions: ScheduleSession[];
}

export interface DriverStandingRow {
  position: number;
  points: number;
  wins: number;
  driverId: string;
  givenName: string;
  familyName: string;
  constructorName: string;
}

export interface ConstructorStandingRow {
  position: number;
  points: number;
  wins: number;
  constructorId: string;
  name: string;
}

export interface StandingsPayload {
  season: string;
  round: string;
  source: string;
  drivers: DriverStandingRow[];
  constructors: ConstructorStandingRow[];
}
