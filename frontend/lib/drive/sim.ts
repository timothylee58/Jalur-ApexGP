import { simulateLap } from "@/lib/lapSim";
import { remapDistance, TRACE_DT, type Trace } from "./timing";
import type { DriveTrack } from "./track";

/**
 * /circuit's simulated 2026 lap as a ghost trace on /drive's track. The
 * simulator solves on its own normalised centreline, so its distances are
 * re-mapped corner apex by corner apex onto this track before sampling —
 * the SIM car brakes for T1 where T1 actually is here.
 */
export function simTrace(track: DriveTrack): { trace: Trace; lapTimeS: number } {
  const sim = simulateLap();
  const simCorners = [...sim.corners].sort((a, b) => a.s - b.s);
  const from = [0];
  const to = [0];
  for (const c of simCorners) {
    const here = track.corners.find((d) => d.turn === c.turn);
    if (!here) continue;
    // Keep both lists strictly increasing so the mapping stays one-to-one.
    if (c.s <= from[from.length - 1] || here.s <= to[to.length - 1]) continue;
    from.push(c.s);
    to.push(here.s);
  }
  from.push(sim.lengthM);
  to.push(track.length);

  const samples = sim.samples;
  const trace: Trace = [];
  let i = 0;
  for (let t = 0; t <= sim.lapTimeS; t += TRACE_DT) {
    while (i < samples.length - 2 && samples[i + 1].t <= t) i += 1;
    const a = samples[i];
    const b = samples[i + 1];
    const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    const s = a.s + (b.s - a.s) * f;
    trace.push(remapDistance(s, from, to));
  }
  trace.push(track.length);
  return { trace, lapTimeS: sim.lapTimeS };
}
