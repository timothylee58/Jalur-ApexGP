import { describe, expect, it } from "vitest";
import { directionsUrl, SHUTTLE_PICKUPS, shuttleStatus } from "@/lib/raceShuttle";

const myt = (iso: string) => new Date(`${iso}+08:00`);

describe("shuttleStatus", () => {
  it("counts down to the first bus before the weekend", () => {
    const status = shuttleStatus(myt("2026-10-01T21:00:00"));
    expect(status).toEqual({ kind: "upcoming", nextStart: myt("2026-10-02T07:00:00") });
  });

  it("is running from 7am, right up to midnight", () => {
    expect(shuttleStatus(myt("2026-10-02T07:00:00"))).toEqual({
      kind: "running",
      endsAt: myt("2026-10-03T00:00:00"),
    });
    expect(shuttleStatus(myt("2026-10-04T23:59:00")).kind).toBe("running");
  });

  it("pauses overnight between race days instead of reading as finished", () => {
    expect(shuttleStatus(myt("2026-10-03T03:30:00"))).toEqual({
      kind: "overnight",
      nextStart: myt("2026-10-03T07:00:00"),
    });
  });

  it("ends at midnight after the race", () => {
    expect(shuttleStatus(myt("2026-10-05T00:00:00")).kind).toBe("ended");
  });

  it("reads the same instant identically from any viewer time zone", () => {
    const fromLondon = new Date("2026-10-04T08:00:00+01:00");
    expect(shuttleStatus(fromLondon)).toEqual({ kind: "running", endsAt: myt("2026-10-05T00:00:00") });
  });
});

describe("directionsUrl", () => {
  it("encodes the pickup's search query", () => {
    expect(directionsUrl(SHUTTLE_PICKUPS[2])).toBe(
      "https://www.google.com/maps/search/?api=1&query=De-Village%20Persiaran%20Millenia%202%20Bandar%20Baru%20Enstek",
    );
  });
});
