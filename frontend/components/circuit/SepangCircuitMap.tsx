import {
  circuitMarkers,
  circuitPath,
  circuitViewBox,
  startFinish,
} from "@/data/sepangCircuit";

export interface StandMarker {
  id: string;
  /** Short label drawn on the map, e.g. "K2", "F", "Main". */
  code: string;
  /** SVG-space position — from `pointForName()` in sepangCircuit.ts. */
  x: number;
  y: number;
  kind: "grandstand" | "hillstand";
  selected?: boolean;
}

interface SepangCircuitMapProps {
  /** Corner codes to highlight (e.g. ["T1","T9"]) — matches referencedCorners.
   * Semantically distinct from `stands` below: this highlights the 4
   * corners the strategy engine reasons about, not grandstand positions. */
  highlighted?: string[];
  /** Grandstand/hillstand markers at their real apex-point positions —
   * separate from `highlighted` since a stand's real view doesn't
   * necessarily land on one of those 4 curated corners. */
  stands?: StandMarker[];
  className?: string;
  /** Faded, decorative-only rendering for use as a background (e.g. the hero). */
  muted?: boolean;
}

export function SepangCircuitMap({
  highlighted = [],
  stands = [],
  className,
  muted = false,
}: SepangCircuitMapProps) {
  const active = new Set(highlighted);
  const trackColor = muted ? "#2a3036" : "#3a4048";

  return (
    <svg
      viewBox={circuitViewBox}
      className={className}
      role="img"
      aria-label={
        highlighted.length > 0
          ? `Sepang circuit map highlighting ${highlighted.join(", ")}`
          : "Sepang International Circuit map"
      }
    >
      {/* Track ribbon: a wide dark stroke under a thin centre line. */}
      <path d={circuitPath} fill="none" stroke={trackColor} strokeWidth={26} strokeLinejoin="round" />
      <path
        d={circuitPath}
        fill="none"
        stroke={muted ? "#3a4048" : "#5b636d"}
        strokeWidth={2}
        strokeDasharray="2 12"
        strokeLinecap="round"
      />

      {/* Start/finish tick. */}
      {!muted ? (
        <circle cx={startFinish.x} cy={startFinish.y} r={9} fill="#f4efe6" stroke="#14181c" strokeWidth={2} />
      ) : null}

      {!muted
        ? circuitMarkers.map((marker) => {
            const on = marker.code !== null && active.has(marker.code);
            return (
              <g key={marker.label}>
                {on ? (
                  <circle cx={marker.x} cy={marker.y} r={26} fill="#f5a623" opacity={0.18} />
                ) : null}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={on ? 11 : 7}
                  fill={on ? "#f5a623" : "#14181c"}
                  stroke={on ? "#f5a623" : "#5b636d"}
                  strokeWidth={2}
                />
                <text
                  x={marker.x}
                  y={marker.y - 22}
                  textAnchor="middle"
                  fontSize={30}
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight={700}
                  fill={on ? "#f5a623" : "#a39b8f"}
                >
                  {marker.label}
                </text>
              </g>
            );
          })
        : null}

      {!muted
        ? stands.map((stand) => {
            const color = stand.selected ? "#f5a623" : "#a39b8f";
            const size = stand.selected ? 20 : 14;
            return (
              <g key={stand.id}>
                {stand.selected ? (
                  <circle cx={stand.x} cy={stand.y} r={34} fill="#f5a623" opacity={0.15} />
                ) : null}
                {stand.kind === "grandstand" ? (
                  <rect
                    x={stand.x - size / 2}
                    y={stand.y - size / 2}
                    width={size}
                    height={size}
                    rx={3}
                    fill={stand.selected ? "#f5a623" : "#14181c"}
                    stroke={color}
                    strokeWidth={2}
                  />
                ) : (
                  <polygon
                    points={`${stand.x},${stand.y - size * 0.6} ${stand.x - size * 0.55},${stand.y + size * 0.5} ${stand.x + size * 0.55},${stand.y + size * 0.5}`}
                    fill={stand.selected ? "#f5a623" : "#14181c"}
                    stroke={color}
                    strokeWidth={2}
                  />
                )}
                <text
                  x={stand.x}
                  y={stand.y - size - 8}
                  textAnchor="middle"
                  fontSize={24}
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight={700}
                  fill={color}
                >
                  {stand.code}
                </text>
              </g>
            );
          })
        : null}
    </svg>
  );
}
