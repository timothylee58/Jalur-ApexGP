import type { TelemetryLapTrace, TelemetrySample } from "@/types/telemetry";

/** Nearest sample to a given time into the lap — OpenF1's ~3.7 Hz sampling
 * (~270ms apart) is fine-grained enough that nearest-neighbor reads as
 * smooth for a HUD; not worth the complexity of interpolating every
 * channel (speed, throttle, brake, rpm, gear, drs) for that little gain. */
export function sampleAt(samples: TelemetrySample[], t: number): TelemetrySample | null {
  if (samples.length === 0) return null;
  if (t <= samples[0].t) return samples[0];
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1];

  // Samples are already sorted by t (guaranteed by the backend) — linear
  // scan is fine at this size (a lap is a few hundred samples), and
  // avoids pulling in a binary-search helper for one call site.
  let closest = samples[0];
  let closestDiff = Math.abs(samples[0].t - t);
  for (const sample of samples) {
    const diff = Math.abs(sample.t - t);
    if (diff < closestDiff) {
      closest = sample;
      closestDiff = diff;
    }
    if (sample.t > t) break;
  }
  return closest;
}

/**
 * Cumulative fraction of the lap's total distance covered by each sample
 * (trapezoidal integration of speed over time, speed converted km/h→m/s).
 * Used to pace movement along /circuit's own stylized track curve by the
 * real lap's actual speed rhythm — real corners slow the fictional car
 * down at whatever point in OUR curve corresponds to that fraction of
 * distance, even though the real corner positions don't line up with the
 * fictional ones. Time fraction alone (t / lapDuration) would move the car
 * at a constant on-screen pace while the displayed speed number
 * fluctuated, visibly disagreeing with itself.
 */
export function buildDistanceProgress(samples: TelemetrySample[]): number[] {
  if (samples.length === 0) return [];
  const cumulative: number[] = [0];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = samples[i].t - samples[i - 1].t;
    const avgSpeedMs = ((samples[i].speed + samples[i - 1].speed) / 2) * (1000 / 3600);
    cumulative.push(cumulative[i - 1] + avgSpeedMs * Math.max(dt, 0));
  }
  const total = cumulative[cumulative.length - 1] || 1;
  return cumulative.map((value) => value / total);
}

/** Distance-based progress fraction (0–1) at time `t` into the lap, linearly
 * interpolated between the two samples bracketing it. `progress` is
 * `buildDistanceProgress(trace.samples)`, precomputed once per trace. */
export function progressFractionAt(
  samples: TelemetrySample[],
  progress: number[],
  t: number,
): number {
  if (samples.length === 0) return 0;
  if (t <= samples[0].t) return progress[0] ?? 0;
  const last = samples.length - 1;
  if (t >= samples[last].t) return progress[last] ?? 1;

  for (let i = 1; i <= last; i += 1) {
    if (samples[i].t >= t) {
      const span = samples[i].t - samples[i - 1].t;
      const frac = span > 0 ? (t - samples[i - 1].t) / span : 0;
      return progress[i - 1] + (progress[i] - progress[i - 1]) * frac;
    }
  }
  return progress[last];
}

export function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(3).padStart(6, "0")}`;
}

/** DRS status codes OpenF1 actually uses, collapsed to what's worth
 * showing — several numeric codes all mean "open," several mean
 * "closed/unavailable." See telemetry_service.py for why the raw code is
 * still what's stored/transmitted. */
export function isDrsActive(drs: number): boolean {
  return drs === 10 || drs === 12 || drs === 14;
}

export function lapProgressLabel(trace: TelemetryLapTrace, currentTime: number): string {
  return `${formatLapTime(currentTime)} / ${formatLapTime(trace.lapDuration)}`;
}
